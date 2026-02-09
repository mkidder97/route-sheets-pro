import { useCallback, useState } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  fuzzyMatchColumns,
  mapRowToBuilding,
  ParsedBuilding,
  SYSTEM_FIELDS,
} from "@/lib/spreadsheet-parser";
import { FileDropZone } from "@/components/upload/FileDropZone";
import { ColumnMapper } from "@/components/upload/ColumnMapper";
import { DataReview } from "@/components/upload/DataReview";

type Step = "upload" | "mapping" | "review" | "importing" | "done";

export default function UploadPage() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [parsedBuildings, setParsedBuildings] = useState<ParsedBuilding[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ buildings: number; clients: number; regions: number; inspectors: number } | null>(null);

  // Step 1: Parse file
  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    try {
      const data = await f.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
        defval: "",
        raw: false,
      });

      if (jsonData.length === 0) {
        toast.error("Spreadsheet appears to be empty");
        return;
      }

      const detectedHeaders = Object.keys(jsonData[0]);
      setHeaders(detectedHeaders);
      setRows(jsonData);

      // Auto-map columns
      const autoMapping = fuzzyMatchColumns(detectedHeaders);
      setMapping(autoMapping);

      setStep("mapping");
      toast.success(`Parsed ${jsonData.length} rows with ${detectedHeaders.length} columns`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to parse file. Make sure it's a valid Excel or CSV file.");
    }
  }, []);

  // Step 2 → 3: Build parsed buildings
  const handleConfirmMapping = useCallback(() => {
    // Validate required fields
    const missing = SYSTEM_FIELDS.filter((f) => f.required && !mapping[f.key]);
    if (missing.length > 0) {
      toast.error(`Please map required fields: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }

    const buildings = rows.map((row) => mapRowToBuilding(row, mapping));
    setParsedBuildings(buildings);
    setStep("review");
  }, [rows, mapping]);

  // Step 4: Import to Supabase
  const handleImport = useCallback(async () => {
    setImporting(true);
    setStep("importing");

    try {
      // 1. Collect unique clients, regions, inspectors
      const clientNames = [...new Set(parsedBuildings.map((b) => b.client_name).filter(Boolean))];
      const regionNames = [...new Set(parsedBuildings.map((b) => b.market_region).filter(Boolean))];
      const inspectorNames = [...new Set(parsedBuildings.map((b) => b.inspector_name).filter(Boolean))];

      // 2. Upsert clients
      const clientMap: Record<string, string> = {};
      for (const name of clientNames) {
        const { data: existing } = await supabase.from("clients").select("id").eq("name", name).maybeSingle();
        if (existing) {
          clientMap[name] = existing.id;
        } else {
          const { data: created, error } = await supabase.from("clients").insert({ name }).select("id").single();
          if (error) throw error;
          clientMap[name] = created.id;
        }
      }

      // 3. Upsert regions
      const regionMap: Record<string, string> = {};
      for (const rName of regionNames) {
        // Use first available client for the region
        const building = parsedBuildings.find((b) => b.market_region === rName && b.client_name);
        const clientId = building ? clientMap[building.client_name] : Object.values(clientMap)[0];
        if (!clientId) continue;

        const { data: existing } = await supabase
          .from("regions")
          .select("id")
          .eq("name", rName)
          .eq("client_id", clientId)
          .maybeSingle();

        if (existing) {
          regionMap[rName] = existing.id;
        } else {
          const { data: created, error } = await supabase
            .from("regions")
            .insert({ name: rName, client_id: clientId })
            .select("id")
            .single();
          if (error) throw error;
          regionMap[rName] = created.id;
        }
      }

      // 4. Upsert inspectors
      const inspectorMap: Record<string, string> = {};
      for (const iName of inspectorNames) {
        const { data: existing } = await supabase.from("inspectors").select("id").eq("name", iName).maybeSingle();
        if (existing) {
          inspectorMap[iName] = existing.id;
        } else {
          // Find a region for this inspector
          const building = parsedBuildings.find((b) => b.inspector_name === iName && b.market_region);
          const regionId = building ? regionMap[building.market_region] : null;

          const { data: created, error } = await supabase
            .from("inspectors")
            .insert({ name: iName, region_id: regionId })
            .select("id")
            .single();
          if (error) throw error;
          inspectorMap[iName] = created.id;
        }
      }

      // 5. Record the upload first so we have an upload_id for buildings
      const firstClientId = Object.values(clientMap)[0] ?? null;
      const { data: uploadRecord, error: uploadError } = await supabase
        .from("uploads")
        .insert({
          file_name: file?.name ?? "unknown",
          row_count: parsedBuildings.length,
          status: "complete",
          client_id: firstClientId,
        })
        .select("id")
        .single();
      if (uploadError) throw uploadError;

      // 6. Insert buildings in batches with upload_id
      const BATCH_SIZE = 50;
      let insertedCount = 0;

      for (let i = 0; i < parsedBuildings.length; i += BATCH_SIZE) {
        const batch = parsedBuildings.slice(i, i + BATCH_SIZE).map((b) => ({
          upload_id: uploadRecord.id,
          client_id: clientMap[b.client_name] ?? Object.values(clientMap)[0],
          region_id: regionMap[b.market_region] ?? Object.values(regionMap)[0],
          inspector_id: inspectorMap[b.inspector_name] ?? null,
          roof_group: b.roof_group || null,
          building_code: b.building_code || null,
          stop_number: b.stop_number || null,
          property_name: b.property_name || "Unknown",
          address: b.address || "Unknown",
          city: b.city || "Unknown",
          state: b.state || "Unknown",
          zip_code: b.zip_code || "Unknown",
          scheduled_week: b.scheduled_week || null,
          square_footage: b.square_footage,
          roof_access_type: b.roof_access_type as any,
          roof_access_description: b.roof_access_description || null,
          access_location: b.access_location || null,
          lock_gate_codes: b.lock_gate_codes || null,
          special_notes: b.special_notes || null,
          requires_advance_notice: b.requires_advance_notice,
          requires_escort: b.requires_escort,
          special_equipment: b.special_equipment.length > 0 ? b.special_equipment : null,
          is_priority: b.is_priority,
        }));

        const { error } = await supabase.from("buildings").insert(batch);
        if (error) throw error;
        insertedCount += batch.length;
      }

      setImportResult({
        buildings: insertedCount,
        clients: clientNames.length,
        regions: regionNames.length,
        inspectors: inspectorNames.length,
      });
      setStep("done");
      toast.success(`Imported ${insertedCount} buildings successfully!`);
    } catch (err: any) {
      console.error("Import error:", err);
      toast.error(`Import failed: ${err.message}`);
      setStep("review");
    } finally {
      setImporting(false);
    }
  }, [parsedBuildings, file]);

  const handleReset = () => {
    setStep("upload");
    setFile(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setParsedBuildings([]);
    setImportResult(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Upload Spreadsheet</h1>
        <p className="text-muted-foreground mt-1">
          Import building inspection data from Excel or CSV files
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {(["Upload", "Map Columns", "Review", "Import"] as const).map((label, i) => {
          const stepOrder = ["upload", "mapping", "review", "importing"];
          const currentIdx = stepOrder.indexOf(step === "done" ? "importing" : step);
          const isActive = i <= currentIdx;
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <div className={`h-px w-8 ${isActive ? "bg-primary" : "bg-border"}`} />}
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isActive ? "bg-primary text-primary-foreground" : "bg-muted-foreground/30 text-muted-foreground"
                }`}>
                  {step === "done" && i === 3 ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                {label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      {step === "upload" && (
        <Card className="bg-card border-border">
          <CardContent className="p-8">
            <FileDropZone onFile={handleFile} file={file} loading={false} />
          </CardContent>
        </Card>
      )}

      {step === "mapping" && (
        <>
          <ColumnMapper
            headers={headers}
            mapping={mapping}
            onMappingChange={(key, val) =>
              setMapping((prev) => {
                const next = { ...prev };
                if (val) next[key] = val;
                else delete next[key];
                return next;
              })
            }
            previewRows={rows.slice(0, 5)}
          />
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("upload")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button onClick={handleConfirmMapping}>
              Review Data <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </>
      )}

      {step === "review" && (
        <>
          <DataReview buildings={parsedBuildings} />
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("mapping")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Re-map Columns
            </Button>
            <Button onClick={handleImport}>
              <Check className="h-4 w-4 mr-2" /> Import {parsedBuildings.length} Buildings
            </Button>
          </div>
        </>
      )}

      {step === "importing" && (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
            <p className="text-lg font-medium">Importing data…</p>
            <p className="text-sm text-muted-foreground mt-1">
              Creating clients, regions, inspectors, and buildings
            </p>
          </CardContent>
        </Card>
      )}

      {step === "done" && importResult && (
        <Card className="bg-card border-border border-success/30">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-success/10 mb-4">
              <Check className="h-10 w-10 text-success" />
            </div>
            <h2 className="text-2xl font-bold">Import Complete</h2>
            <div className="flex gap-6 mt-4 text-sm">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{importResult.buildings}</p>
                <p className="text-muted-foreground">Buildings</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-info">{importResult.regions}</p>
                <p className="text-muted-foreground">Regions</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-success">{importResult.inspectors}</p>
                <p className="text-muted-foreground">Inspectors</p>
              </div>
            </div>
            <Button className="mt-8" onClick={handleReset}>
              Upload Another File
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
