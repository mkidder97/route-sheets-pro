import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Calendar,
  FileText,
  Download,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Check,
  FileSpreadsheet,
  PackageOpen,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
import {
  generateInspectorPDF,
  type DayData,
  type BuildingData,
  type DocumentMetadata,
} from "@/lib/pdf-generator";
import { generateInspectorExcel } from "@/lib/excel-generator";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";

type Step = "config" | "preview" | "generate";

interface InspectorPreview {
  inspector: Tables<"inspectors">;
  buildingCount: number;
  dayCount: number;
  routePlanId: string;
}


export default function Schedules() {
  const [step, setStep] = useState<Step>("config");

  // Selectors
  const [clients, setClients] = useState<Tables<"clients">[]>([]);
  const [regions, setRegions] = useState<Tables<"regions">[]>([]);
  const [inspectors, setInspectors] = useState<Tables<"inspectors">[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedInspector, setSelectedInspector] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [docFormat, setDocFormat] = useState<"pdf" | "excel">("pdf");

  // Preview data
  const [inspectorPreviews, setInspectorPreviews] = useState<InspectorPreview[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Generation
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");

  // History
  const [history, setHistory] = useState<any[]>([]);


  // Load clients
  useEffect(() => {
    supabase
      .from("clients")
      .select("*")
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) setClients(data);
      });
    loadHistory();
  }, []);

  // Load regions
  useEffect(() => {
    if (!selectedClient) {
      setRegions([]);
      return;
    }
    setSelectedRegion("");
    supabase
      .from("regions")
      .select("*")
      .eq("client_id", selectedClient)
      .then(({ data }) => {
        if (data) setRegions(data);
      });
  }, [selectedClient]);

  // Load inspectors
  useEffect(() => {
    if (!selectedRegion) {
      setInspectors([]);
      return;
    }
    setSelectedInspector("all");
    supabase
      .from("inspectors")
      .select("*")
      .eq("region_id", selectedRegion)
      .then(({ data }) => {
        if (data) setInspectors(data);
      });
  }, [selectedRegion]);

  const loadHistory = async () => {
    const { data } = await supabase
      .from("generated_documents")
      .select("*, clients(name), regions(name), inspectors(name)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setHistory(data);
  };

  // Load preview data
  const handlePreview = useCallback(async () => {
    setLoadingPreview(true);
    try {
      const inspectorIds =
        selectedInspector === "all"
          ? inspectors.map((i) => i.id)
          : [selectedInspector];

      const previews: InspectorPreview[] = [];

      for (const iid of inspectorIds) {
        let query = supabase
          .from("route_plans")
          .select("id")
          .eq("client_id", selectedClient)
          .eq("region_id", selectedRegion)
          .eq("inspector_id", iid);

        if (startDate) query = query.gte("start_date", startDate);
        if (endDate) query = query.lte("end_date", endDate);

        const { data: plans } = await query;
        if (!plans || plans.length === 0) continue;

        const planId = plans[0].id;

        const { data: days } = await supabase
          .from("route_plan_days")
          .select("id")
          .eq("route_plan_id", planId);

        const dayIds = days?.map((d) => d.id) || [];
        let buildingCount = 0;
        if (dayIds.length > 0) {
          const { count } = await supabase
            .from("route_plan_buildings")
            .select("id", { count: "exact", head: true })
            .in("route_plan_day_id", dayIds);
          buildingCount = count || 0;
        }

        const insp = inspectors.find((i) => i.id === iid);
        if (insp) {
          previews.push({
            inspector: insp,
            buildingCount,
            dayCount: dayIds.length,
            routePlanId: planId,
          });
        }
      }

      if (previews.length === 0) {
        toast.error("No route plans found for the selected filters");
        setLoadingPreview(false);
        return;
      }

      setInspectorPreviews(previews);
      setStep("preview");
    } catch (err: any) {
      toast.error(`Error loading preview: ${err.message}`);
    }
    setLoadingPreview(false);
  }, [selectedClient, selectedRegion, selectedInspector, inspectors, startDate, endDate]);

  // Load full day/building data for a route plan
  const loadRoutePlanData = async (
    planId: string
  ): Promise<DayData[]> => {
    const { data: days } = await supabase
      .from("route_plan_days")
      .select("*")
      .eq("route_plan_id", planId)
      .order("day_number");

    if (!days || days.length === 0) return [];

    const result: DayData[] = [];

    for (const day of days) {
      const { data: rpBuildings } = await supabase
        .from("route_plan_buildings")
        .select("*, buildings(*)")
        .eq("route_plan_day_id", day.id)
        .order("stop_order");

      const buildings: BuildingData[] = (rpBuildings || []).map((rpb: any) => ({
        id: rpb.building_id,
        stop_order: rpb.stop_order,
        property_name: rpb.buildings.property_name,
        address: rpb.buildings.address,
        city: rpb.buildings.city,
        state: rpb.buildings.state,
        zip_code: rpb.buildings.zip_code,
        square_footage: rpb.buildings.square_footage,
        roof_group: rpb.buildings.roof_group,
        building_code: rpb.buildings.building_code,
        roof_access_type: rpb.buildings.roof_access_type,
        access_location: rpb.buildings.access_location,
        lock_gate_codes: rpb.buildings.lock_gate_codes,
        is_priority: rpb.buildings.is_priority,
        requires_advance_notice: rpb.buildings.requires_advance_notice,
        requires_escort: rpb.buildings.requires_escort,
        special_equipment: rpb.buildings.special_equipment,
        special_notes: rpb.buildings.special_notes,
        property_manager_name: rpb.buildings.property_manager_name,
        property_manager_phone: rpb.buildings.property_manager_phone,
        property_manager_email: rpb.buildings.property_manager_email,
      }));

      result.push({
        day_number: day.day_number,
        day_date: day.day_date,
        estimated_distance_miles: day.estimated_distance_miles
          ? Number(day.estimated_distance_miles)
          : null,
        buildings,
      });
    }

    return result;
  };

  // Generate documents
  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setProgress(0);
    setStep("generate");

    try {
      const clientName =
        clients.find((c) => c.id === selectedClient)?.name || "Client";
      const regionName =
        regions.find((r) => r.id === selectedRegion)?.name || "Region";

      const isAll = selectedInspector === "all";
      const total = inspectorPreviews.length;

      if (isAll && total > 1 && docFormat === "pdf") {
        // Batch ZIP mode
        const zip = new JSZip();

        for (let i = 0; i < inspectorPreviews.length; i++) {
          const prev = inspectorPreviews[i];
          setProgressLabel(`Generating PDF for ${prev.inspector.name}…`);
          setProgress(Math.round(((i + 0.5) / total) * 100));

          const days = await loadRoutePlanData(prev.routePlanId);
          const meta: DocumentMetadata = {
            clientName,
            regionName,
            inspectorName: prev.inspector.name,
            startDate: startDate || days[0]?.day_date || new Date().toISOString().split("T")[0],
            endDate: endDate || days[days.length - 1]?.day_date || new Date().toISOString().split("T")[0],
          };

          const pdf = generateInspectorPDF(days, meta);
          const blob = pdf.output("arraybuffer");
          const safeName = prev.inspector.name.replace(/[^a-zA-Z0-9]/g, "_");
          zip.file(`${safeName}_Schedule.pdf`, blob);

          // Save history record
          await supabase.from("generated_documents").insert({
            route_plan_id: prev.routePlanId,
            client_id: selectedClient,
            region_id: selectedRegion,
            inspector_id: prev.inspector.id,
            format: "pdf",
            file_name: `${safeName}_Schedule.pdf`,
          });

          setProgress(Math.round(((i + 1) / total) * 100));
        }

        setProgressLabel("Bundling ZIP…");
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const safeClient = clientName.replace(/[^a-zA-Z0-9]/g, "_");
        const safeRegion = regionName.replace(/[^a-zA-Z0-9]/g, "_");
        saveAs(zipBlob, `${safeClient}_${safeRegion}_Schedules.zip`);

        toast.success(`Downloaded ZIP with ${total} inspector PDFs`);
      } else {
        // Single inspector (or single "all" that has one inspector)
        for (let i = 0; i < inspectorPreviews.length; i++) {
          const prev = inspectorPreviews[i];
          setProgressLabel(`Generating for ${prev.inspector.name}…`);
          setProgress(Math.round(((i + 0.5) / total) * 100));

          const days = await loadRoutePlanData(prev.routePlanId);
          const meta: DocumentMetadata = {
            clientName,
            regionName,
            inspectorName: prev.inspector.name,
            startDate: startDate || days[0]?.day_date || new Date().toISOString().split("T")[0],
            endDate: endDate || days[days.length - 1]?.day_date || new Date().toISOString().split("T")[0],
          };

          const safeName = prev.inspector.name.replace(/[^a-zA-Z0-9]/g, "_");

          if (docFormat === "pdf") {
            const pdf = generateInspectorPDF(days, meta);
            pdf.save(`${safeName}_Schedule.pdf`);
          } else {
            const wb = generateInspectorExcel(days, meta);
            XLSX.writeFile(wb, `${safeName}_Schedule.xlsx`);
          }

          await supabase.from("generated_documents").insert({
            route_plan_id: prev.routePlanId,
            client_id: selectedClient,
            region_id: selectedRegion,
            inspector_id: prev.inspector.id,
            format: docFormat,
            file_name: `${safeName}_Schedule.${docFormat === "pdf" ? "pdf" : "xlsx"}`,
          });

          setProgress(Math.round(((i + 1) / total) * 100));
        }

        toast.success("Document generated successfully!");
      }

      setProgress(100);
      setProgressLabel("Done!");
      loadHistory();
    } catch (err: any) {
      console.error(err);
      toast.error(`Generation failed: ${err.message}`);
    }
    setGenerating(false);
  }, [
    inspectorPreviews,
    selectedClient,
    selectedRegion,
    selectedInspector,
    docFormat,
    clients,
    regions,
    startDate,
    endDate,
  ]);


  const canProceed =
    selectedClient && selectedRegion && selectedInspector;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Schedules</h1>
        <p className="text-muted-foreground mt-1">
          Generate inspector route documents
        </p>
      </div>

      {/* ── STEP 1: CONFIG ── */}
      {step === "config" && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Generate Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Region</Label>
                <Select
                  value={selectedRegion}
                  onValueChange={setSelectedRegion}
                  disabled={!selectedClient}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        selectedClient ? "Select region" : "Select client first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Inspector</Label>
                <Select
                  value={selectedInspector}
                  onValueChange={setSelectedInspector}
                  disabled={!selectedRegion}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        selectedRegion ? "Select inspector" : "Select region first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        All Inspectors
                      </span>
                    </SelectItem>
                    {inspectors.map((ins) => (
                      <SelectItem key={ins.id} value={ins.id}>
                        {ins.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Start Date (optional)</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date (optional)</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Format</Label>
                <Select
                  value={docFormat}
                  onValueChange={(v) => setDocFormat(v as "pdf" | "excel")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">
                      <span className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        PDF Document
                      </span>
                    </SelectItem>
                    <SelectItem value="excel">
                      <span className="flex items-center gap-1.5">
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        Excel Spreadsheet
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handlePreview}
              disabled={!canProceed || loadingPreview}
              className="mt-2"
            >
              {loadingPreview ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              Preview & Generate
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── STEP 2: PREVIEW ── */}
      {step === "preview" && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Review Before Generating</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg bg-muted">
                <div className="text-xs text-muted-foreground">Client</div>
                <div className="font-semibold mt-1">
                  {clients.find((c) => c.id === selectedClient)?.name}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <div className="text-xs text-muted-foreground">Region</div>
                <div className="font-semibold mt-1">
                  {regions.find((r) => r.id === selectedRegion)?.name}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <div className="text-xs text-muted-foreground">Format</div>
                <div className="font-semibold mt-1 uppercase">{docFormat}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <div className="text-xs text-muted-foreground">Inspectors</div>
                <div className="font-semibold mt-1">
                  {inspectorPreviews.length}
                </div>
              </div>
            </div>

            {selectedInspector === "all" && inspectorPreviews.length > 1 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <PackageOpen className="h-4 w-4 text-primary" />
                <span className="text-sm">
                  <strong>Batch mode:</strong>{" "}
                  {docFormat === "pdf"
                    ? `${inspectorPreviews.length} PDFs will be bundled into a single ZIP file.`
                    : `${inspectorPreviews.length} Excel files will be downloaded individually.`}
                </span>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Inspector</TableHead>
                  <TableHead className="text-center">Days</TableHead>
                  <TableHead className="text-center">Buildings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inspectorPreviews.map((p) => (
                  <TableRow key={p.inspector.id}>
                    <TableCell className="font-medium">
                      {p.inspector.name}
                    </TableCell>
                    <TableCell className="text-center">{p.dayCount}</TableCell>
                    <TableCell className="text-center">
                      {p.buildingCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("config")}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button onClick={handleGenerate}>
                <Download className="h-4 w-4 mr-2" />
                Generate{" "}
                {inspectorPreviews.length > 1
                  ? `All (${inspectorPreviews.length})`
                  : "Document"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}


      {/* ── STEP 3: GENERATING ── */}
      {step === "generate" && (
        <Card className="bg-card border-border">
          <CardContent className="py-12 space-y-6">
            <div className="flex flex-col items-center text-center space-y-4">
              {generating ? (
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
              ) : (
                <div className="p-3 rounded-full bg-primary/20">
                  <Check className="h-8 w-8 text-primary" />
                </div>
              )}
              <div>
                <h2 className="text-xl font-semibold">
                  {generating ? "Generating Documents…" : "Generation Complete!"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {progressLabel}
                </p>
              </div>
            </div>

            <Progress value={progress} className="max-w-md mx-auto" />

            {!generating && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("config");
                    setProgress(0);
                    setProgressLabel("");
                  }}
                >
                  Generate Another
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── DOCUMENT HISTORY ── */}
      {history.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Generation History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Inspector</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Generated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((doc: any) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-mono text-sm">
                      {doc.file_name}
                    </TableCell>
                    <TableCell>{doc.clients?.name || "—"}</TableCell>
                    <TableCell>{doc.regions?.name || "—"}</TableCell>
                    <TableCell>{doc.inspectors?.name || "Batch"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="uppercase text-xs">
                        {doc.format}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(doc.created_at), "MMM d, yyyy h:mm a")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
