import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";

type Step = "upload" | "preview" | "result";

interface MatchedRow {
  buildingId: string;
  propertyCode: string;
  propertyName: string;
  siteContact: string;
  email: string;
  phone: string;
}

interface UnmatchedRow {
  propertyCode: string;
  siteContact: string;
  email: string;
}

export default function AdminData() {
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [matched, setMatched] = useState<MatchedRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [withEmail, setWithEmail] = useState(0);
  const [unmatched, setUnmatched] = useState(0);
  const [missingCols, setMissingCols] = useState<string[]>([]);
  const [unmatchedRows, setUnmatchedRows] = useState<UnmatchedRow[]>([]);
  const [showSkipped, setShowSkipped] = useState(false);
  const [resultUpdated, setResultUpdated] = useState(0);
  const [resultSkipped, setResultSkipped] = useState(0);

  const reset = () => {
    setStep("upload");
    setMatched([]);
    setTotalRows(0);
    setWithEmail(0);
    setUnmatched(0);
    setMissingCols([]);
    setUnmatchedRows([]);
    setShowSkipped(false);
  };

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);

    try {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];

      // Build normalized header map
      const rawHeaders = (XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][])[0] as string[];
      const headerMap: Record<string, string> = {};
      rawHeaders.forEach((h) => {
        if (typeof h === "string") headerMap[h.trim().toLowerCase()] = h;
      });
      const col = (key: string) => headerMap[key.trim().toLowerCase()] ?? "";

      // Detect missing columns (tolerate "porperty code" typo from Roof Controller)
      const propCodeFound = col("property code") || col("porperty code");
      const otherExpected = ["site contact", "site contact email", "site contact office phone"];
      const missing = [
        ...(propCodeFound ? [] : ["property code"]),
        ...otherExpected.filter((k) => col(k) === ""),
      ];
      setMissingCols(missing);

      const rows = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
      setTotalRows(rows.length);

      const propCodeCol = col("property code") || col("porperty code");
      if (!propCodeCol) {
        setMatched([]);
        setUnmatched(rows.length);
        setWithEmail(0);
        setStep("preview");
        setLoading(false);
        return;
      }

      const allCodes = rows
        .map((r) => String(r[propCodeCol] ?? "").trim())
        .filter(Boolean);

      // Fetch buildings in batches (Supabase .in() limit)
      const uniqueCodes = [...new Set(allCodes)];
      const batchSize = 500;
      const buildings: { id: string; building_code: string | null; property_name: string }[] = [];
      for (let i = 0; i < uniqueCodes.length; i += batchSize) {
        const batch = uniqueCodes.slice(i, i + batchSize);
        const { data } = await supabase
          .from("buildings")
          .select("id, building_code, property_name")
          .in("building_code", batch);
        if (data) buildings.push(...data);
      }

      const codeMap = new Map(buildings.map((b) => [b.building_code, b]));

      const siteContactCol = col("site contact");
      const emailCol = col("site contact email");
      const phoneCol = col("site contact office phone");

      const matchedRows: MatchedRow[] = [];
      const unmatchedList: UnmatchedRow[] = [];
      let emailCount = 0;

      for (const row of rows) {
        const code = String(row[propCodeCol] ?? "").trim();
        const building = codeMap.get(code);
        if (!building) {
          unmatchedList.push({
            propertyCode: code,
            siteContact: siteContactCol ? String(row[siteContactCol] ?? "").trim() : "",
            email: emailCol ? String(row[emailCol] ?? "").trim() : "",
          });
          continue;
        }
        const siteContact = siteContactCol ? String(row[siteContactCol] ?? "").trim() : "";
        const email = emailCol ? String(row[emailCol] ?? "").trim() : "";
        const phone = phoneCol ? String(row[phoneCol] ?? "").trim() : "";
        if (email) emailCount++;
        matchedRows.push({
          buildingId: building.id,
          propertyCode: code,
          propertyName: building.property_name,
          siteContact,
          email,
          phone,
        });
      }

      setMatched(matchedRows);
      setUnmatched(unmatchedCount);
      setWithEmail(emailCount);
      setStep("preview");
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  const handleImport = async () => {
    setLoading(true);
    let updated = 0;
    let skipped = 0;

    const updates = matched.map((row) => {
      const payload: Record<string, string> = {};
      if (row.siteContact) payload.property_manager_name = row.siteContact;
      if (row.email) payload.property_manager_email = row.email;
      if (row.phone) payload.property_manager_phone = row.phone;

      if (Object.keys(payload).length === 0) return null;
      return supabase.from("buildings").update(payload).eq("id", row.buildingId);
    });

    const results = await Promise.all(
      updates.map(async (p) => {
        if (!p) return false;
        const { error } = await p;
        return !error;
      })
    );

    results.forEach((ok) => (ok ? updated++ : skipped++));
    setResultUpdated(updated);
    setResultSkipped(skipped);
    setStep("result");
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Data Import</h1>
        <p className="text-muted-foreground mt-1">Import and enrich building data from external exports.</p>
      </div>

      {step === "upload" && (
        <Card className="max-w-xl mx-auto">
          <CardContent className="p-8 flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-muted">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">Upload Export File</h2>
            <p className="text-sm text-muted-foreground text-center">
              Supports the Roof Sections Export format. Matches buildings by Property Code.
            </p>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={handleFile}
                disabled={loading}
              />
              <Button asChild variant="default" disabled={loading}>
                <span>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {loading ? "Parsing…" : "Select .xlsx File"}
                </span>
              </Button>
            </label>
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          {missingCols.length > 0 && (
            <div className="bg-yellow-500/15 border border-yellow-500/30 text-yellow-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
              <div className="text-sm">
                <span className="font-medium">Columns not detected:</span>{" "}
                {missingCols.map((c) => `"${c}"`).join(", ")}. The file format may not match the expected export.
              </div>
            </div>
          )}

          <Card>
            <CardContent className="p-6 grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{totalRows}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Rows</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-400">{matched.length}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Matched</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{withEmail}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">With Email</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-400">{unmatched}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Unmatched</p>
              </div>
            </CardContent>
          </Card>

          {matched.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">Property Code</th>
                    <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">Property Name</th>
                    <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">Site Contact</th>
                    <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">Email</th>
                    <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {matched.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-t border-border hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs">{r.propertyCode}</td>
                      <td className="px-3 py-2">{r.propertyName}</td>
                      <td className="px-3 py-2">{r.siteContact || "—"}</td>
                      <td className="px-3 py-2">{r.email || "—"}</td>
                      <td className="px-3 py-2">{r.phone || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={reset}>Cancel</Button>
            <Button onClick={handleImport} disabled={matched.length === 0 || loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Import {matched.length} Records
            </Button>
          </div>
        </div>
      )}

      {step === "result" && (
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
            <CheckCircle className="h-12 w-12 text-emerald-400" />
            <div className="space-y-1">
              <p className="text-lg font-semibold">✅ {resultUpdated} buildings updated</p>
              {resultSkipped > 0 && (
                <p className="text-sm text-yellow-400">⚠️ {resultSkipped} skipped</p>
              )}
            </div>
            <Button variant="outline" onClick={reset}>Import Another File</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
