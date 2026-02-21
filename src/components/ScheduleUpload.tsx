import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { FileDropZone } from "@/components/upload/FileDropZone";
import {
  SCHEDULE_FIELDS,
  fuzzyMatchScheduleColumns,
  parseScheduledWeek,
  normalizeAddress,
  matchInspector,
} from "@/lib/schedule-parser";
import { ArrowRight, Columns, CheckCircle, Loader2 } from "lucide-react";

interface ScheduleUploadProps {
  open: boolean;
  onClose: () => void;
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface PlanBuilding {
  id: string;
  building_id: string;
  building_code: string | null;
  property_name: string;
  address: string;
  city: string;
  scheduled_week: string | null;
}

type MatchConfidence = "code" | "address" | "manual" | "none";

interface MatchedRow {
  rowIdx: number;
  buildingCode: string;
  address: string;
  propertyName: string;
  scheduledWeek: string | null;
  isPriority: boolean;
  inspectorName: string;
  matchedBuildingId: string | null;
  matchedBuildingName: string | null;
  confidence: MatchConfidence;
  inspectorId: string | null;
  inspectorMatched: boolean;
}

// ─── Step indicator ─────────────────────────────────────────────────────────

const STEPS = ["File & Route Plan", "Map Columns", "Preview & Match", "Apply"];

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1 mb-4">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-1">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
              i < step
                ? "bg-primary text-primary-foreground"
                : i === step
                ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {i < step ? "✓" : i + 1}
          </div>
          <span className={`text-xs hidden sm:inline ${i === step ? "font-medium" : "text-muted-foreground"}`}>
            {label}
          </span>
          {i < STEPS.length - 1 && <div className="w-6 h-px bg-border mx-1" />}
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function ScheduleUpload({ open, onClose }: ScheduleUploadProps) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [routePlanId, setRoutePlanId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [matchedRows, setMatchedRows] = useState<MatchedRow[]>([]);
  const [applying, setApplying] = useState(false);
  const [done, setDone] = useState(false);
  const [skipScheduled, setSkipScheduled] = useState(false);

  // ─── Data queries ───────────────────────────────────────────────────────

  const { data: routePlans = [] } = useQuery({
    queryKey: ["schedule-upload-plans"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("route_plans")
        .select("id, name, clients(name), regions(name), inspector_id, inspectors(name)")
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const { data: planBuildings = [], isLoading: buildingsLoading } = useQuery({
    queryKey: ["schedule-upload-buildings", routePlanId],
    enabled: !!routePlanId,
    queryFn: async () => {
      const { data: days } = await supabase
        .from("route_plan_days")
        .select("id")
        .eq("route_plan_id", routePlanId);
      if (!days || days.length === 0) return [];
      const dayIds = days.map(d => d.id);
      const { data: rpb } = await supabase
        .from("route_plan_buildings")
        .select("building_id, buildings!inner(id, building_code, property_name, address, city, scheduled_week)")
        .in("route_plan_day_id", dayIds);
      const seen = new Set<string>();
      return (rpb ?? [])
        .filter((r: any) => {
          if (seen.has(r.building_id)) return false;
          seen.add(r.building_id);
          return true;
        })
        .map((r: any) => ({
          id: r.buildings.id,
          building_id: r.buildings.id,
          building_code: r.buildings.building_code,
          property_name: r.buildings.property_name,
          address: r.buildings.address,
          city: r.buildings.city,
          scheduled_week: r.buildings.scheduled_week,
        })) as PlanBuilding[];
    },
  });

  const { data: inspectors = [] } = useQuery({
    queryKey: ["schedule-upload-inspectors"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("inspectors").select("id, name").order("name");
      return data ?? [];
    },
  });

  // ─── File parsing ─────────────────────────────────────────────────────────

  const handleFile = useCallback((f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
      if (json.length > 0) {
        const hdrs = Object.keys(json[0]);
        setHeaders(hdrs);
        setRows(json.map((r) => {
          const out: Record<string, string> = {};
          for (const h of hdrs) out[h] = String(r[h] ?? "");
          return out;
        }));
        setMapping(fuzzyMatchScheduleColumns(hdrs));
      }
    };
    reader.readAsArrayBuffer(f);
  }, []);

  // ─── Column mapping helpers ───────────────────────────────────────────────

  const usedHeaders = new Set(Object.values(mapping));
  const requiredMet = SCHEDULE_FIELDS.filter((f) => f.required).every((f) => mapping[f.key]);

  const handleMappingChange = (fieldKey: string, header: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (header) next[fieldKey] = header;
      else delete next[fieldKey];
      return next;
    });
  };

  // ─── Matching logic ──────────────────────────────────────────────────────

  const runMatching = useCallback(() => {
    const results: MatchedRow[] = rows.map((row, idx) => {
      const get = (key: string) => (mapping[key] ? (row[mapping[key]] ?? "").trim() : "");
      const buildingCode = get("building_code");
      const address = get("address");
      const propertyName = get("property_name");
      const scheduledWeekRaw = get("scheduled_week");
      const inspectorNameRaw = get("inspector_name");

      // Parse scheduled week
      const parsed = parseScheduledWeek(scheduledWeekRaw);

      // Detect priority from all row text too
      const allText = Object.values(row).join(" ");
      const textPriority = /priority\s*inspection/i.test(allText);

      // Match building
      let matchedBldg: PlanBuilding | undefined;
      let confidence: MatchConfidence = "none";

      // Try building_code first
      if (buildingCode && buildingCode.toLowerCase() !== "not provided") {
        matchedBldg = planBuildings.find(
          (b) => b.building_code && b.building_code.toLowerCase().trim() === buildingCode.toLowerCase()
        );
        if (matchedBldg) confidence = "code";
      }

      // Fallback to address
      if (!matchedBldg && address) {
        const normAddr = normalizeAddress(address);
        matchedBldg = planBuildings.find(
          (b) => normalizeAddress(b.address) === normAddr
        );
        if (matchedBldg) confidence = "address";
      }

      // Match inspector
      const inspMatch = matchInspector(inspectorNameRaw, inspectors);

      return {
        rowIdx: idx,
        buildingCode,
        address,
        propertyName,
        scheduledWeek: parsed?.date ?? null,
        isPriority: (parsed?.isPriority ?? false) || textPriority,
        inspectorName: inspectorNameRaw,
        matchedBuildingId: matchedBldg?.id ?? null,
        matchedBuildingName: matchedBldg?.property_name ?? null,
        confidence,
        inspectorId: inspMatch?.id ?? null,
        inspectorMatched: !!inspMatch,
      };
    });
    setMatchedRows(results);
  }, [rows, mapping, planBuildings, inspectors]);

  // ─── Manual fix handlers ──────────────────────────────────────────────────

  const handleManualBuildingFix = (rowIdx: number, buildingId: string) => {
    setMatchedRows((prev) =>
      prev.map((r) => {
        if (r.rowIdx !== rowIdx) return r;
        const bldg = planBuildings.find((b) => b.id === buildingId);
        return {
          ...r,
          matchedBuildingId: bldg?.id ?? null,
          matchedBuildingName: bldg?.property_name ?? null,
          confidence: bldg ? "manual" : "none",
        };
      })
    );
  };

  const handleManualInspectorFix = (rowIdx: number, inspectorId: string) => {
    setMatchedRows((prev) =>
      prev.map((r) => {
        if (r.rowIdx !== rowIdx) return r;
        return { ...r, inspectorId: inspectorId || null, inspectorMatched: !!inspectorId };
      })
    );
  };

  // ─── Stats ────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = matchedRows.length;
    const byCode = matchedRows.filter((r) => r.confidence === "code").length;
    const byAddr = matchedRows.filter((r) => r.confidence === "address").length;
    const manual = matchedRows.filter((r) => r.confidence === "manual").length;
    const matched = byCode + byAddr + manual;
    const unmatched = total - matched;
    const priority = matchedRows.filter((r) => r.isPriority).length;
    return { total, byCode, byAddr, manual, matched, unmatched, priority };
  }, [matchedRows]);

  // ─── Apply updates ────────────────────────────────────────────────────────

  const handleApply = async () => {
    setApplying(true);
    let updated = 0;
    let skipped = 0;

    const toUpdate = matchedRows.filter((r) => r.matchedBuildingId && r.scheduledWeek);

    for (const row of toUpdate) {
      // Re-upload handling: skip if building already has scheduled_week and user opted to skip
      if (skipScheduled && planBuildings.find(b => b.id === row.matchedBuildingId)?.scheduled_week) {
        skipped++;
        continue;
      }

      const { error } = await supabase
        .from("buildings")
        .update({
          scheduled_week: row.scheduledWeek,
          is_priority: row.isPriority,
          ...(row.inspectorId ? { inspector_id: row.inspectorId } : {}),
        })
        .eq("id", row.matchedBuildingId!);

      if (error) {
        skipped++;
      } else {
        updated++;
      }
    }

    skipped += matchedRows.filter((r) => !r.matchedBuildingId || !r.scheduledWeek).length;

    toast({
      title: "Schedule applied",
      description: `${updated} buildings updated, ${stats.priority} marked priority, ${skipped} skipped`,
    });

    qc.invalidateQueries({ queryKey: ["sched-events"] });
    qc.invalidateQueries({ queryKey: ["schedule-upload-buildings"] });
    setApplying(false);
    setDone(true);
  };

  // ─── Reset on close ──────────────────────────────────────────────────────

  const handleClose = () => {
    setStep(0);
    setRoutePlanId("");
    setFile(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setMatchedRows([]);
    setApplying(false);
    setDone(false);
    setSkipScheduled(false);
    onClose();
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Upload Schedule</DialogTitle>
        </DialogHeader>

        <StepIndicator step={step} />

        <ScrollArea className="flex-1 min-h-0">
          <div className="pr-4">
            {/* ── STEP 0: File & Route Plan ─────────────────────────────── */}
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Route Plan</label>
                  <Select value={routePlanId} onValueChange={setRoutePlanId}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select route plan…" />
                    </SelectTrigger>
                    <SelectContent>
                      {routePlans.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — {p.clients?.name} / {p.regions?.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <FileDropZone onFile={handleFile} file={file} loading={false} />

                {file && headers.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {rows.length} rows, {headers.length} columns detected
                  </p>
                )}

                <div className="flex justify-end">
                  <Button
                    disabled={!routePlanId || !file || headers.length === 0}
                    onClick={() => setStep(1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* ── STEP 1: Column Mapping ──────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Columns className="h-4 w-4 text-primary" />
                    <span className="font-medium">Map Columns</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Match your spreadsheet columns to schedule fields. Auto-matched where possible.
                  </p>

                  {SCHEDULE_FIELDS.map((field) => (
                    <div key={field.key} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{field.label}</span>
                          {field.required && (
                            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                              Required
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="w-64 flex-shrink-0">
                        <Select
                          value={mapping[field.key] ?? "__none__"}
                          onValueChange={(val) => handleMappingChange(field.key, val === "__none__" ? "" : val)}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select column…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Not mapped —</SelectItem>
                            {headers.map((h) => (
                              <SelectItem
                                key={h}
                                value={h}
                                disabled={usedHeaders.has(h) && mapping[field.key] !== h}
                              >
                                {h}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Preview */}
                {rows.length > 0 && (
                  <div className="overflow-x-auto">
                    <p className="text-sm font-medium mb-2">Data Preview (first 3 rows)</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {SCHEDULE_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                            <TableHead key={f.key} className="text-xs whitespace-nowrap">{f.label}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.slice(0, 3).map((row, i) => (
                          <TableRow key={i}>
                            {SCHEDULE_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                              <TableCell key={f.key} className="text-xs max-w-[200px] truncate">
                                {row[mapping[f.key]] || "—"}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
                  <Button
                    disabled={!requiredMet}
                    onClick={() => {
                      runMatching();
                      setStep(2);
                    }}
                  >
                    Next — Match Buildings
                  </Button>
                </div>
              </div>
            )}

            {/* ── STEP 2: Preview & Match ─────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-4">
                {/* Re-upload handling: skip scheduled checkbox */}
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={skipScheduled} onCheckedChange={(v) => setSkipScheduled(!!v)} />
                  Only update unscheduled buildings (skip rows where a week is already set)
                </label>

                {/* Summary */}
                <div className="p-3 rounded-lg bg-muted/30 text-sm">
                  <span className="font-medium">{stats.matched} of {stats.total}</span> buildings matched
                  {" "}({stats.byCode} by code, {stats.byAddr} by address
                  {stats.manual > 0 && `, ${stats.manual} manual`}
                  , {stats.unmatched} unmatched)
                  {stats.priority > 0 && (
                    <span className="ml-2">
                      · <span className="font-medium text-orange-600 dark:text-orange-400">{stats.priority} priority</span>
                    </span>
                  )}
                </div>

                {/* Match table */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-10">#</TableHead>
                        <TableHead className="text-xs">Building Code</TableHead>
                        <TableHead className="text-xs">Address</TableHead>
                        <TableHead className="text-xs">Matched Building</TableHead>
                        <TableHead className="text-xs">Week</TableHead>
                        <TableHead className="text-xs w-16">Priority</TableHead>
                        <TableHead className="text-xs">Inspector</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matchedRows.map((row) => (
                        <TableRow
                          key={row.rowIdx}
                          className={
                            row.confidence === "code"
                              ? "bg-green-50/50 dark:bg-green-950/20"
                              : row.confidence === "address"
                              ? "bg-yellow-50/50 dark:bg-yellow-950/20"
                              : row.confidence === "manual"
                              ? "bg-blue-50/50 dark:bg-blue-950/20"
                              : "bg-red-50/50 dark:bg-red-950/20"
                          }
                        >
                          <TableCell className="text-xs">{row.rowIdx + 1}</TableCell>
                          <TableCell className="text-xs">{row.buildingCode || "—"}</TableCell>
                          <TableCell className="text-xs max-w-[180px] truncate">{row.address || "—"}</TableCell>
                          <TableCell className="text-xs">
                            {row.matchedBuildingName ? (
                              <span className="flex items-center gap-1">
                                {row.matchedBuildingName}
                                <Badge variant="outline" className={`text-[9px] ml-1 ${
                                  row.confidence === "code"
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    : row.confidence === "address"
                                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                }`}>
                                  {row.confidence}
                                </Badge>
                              </span>
                            ) : (
                              <Select
                                value="__none__"
                                onValueChange={(val) => val !== "__none__" && handleManualBuildingFix(row.rowIdx, val)}
                              >
                                <SelectTrigger className="h-7 text-xs bg-background border-destructive/30 w-48">
                                  <SelectValue placeholder="Select building…" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">— Unmatched —</SelectItem>
                                  {planBuildings.map((b) => (
                                    <SelectItem key={b.id} value={b.id}>
                                      {b.property_name} — {b.address}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.scheduledWeek || "—"}
                            {row.matchedBuildingId && (() => {
                              const existing = planBuildings.find(b => b.id === row.matchedBuildingId)?.scheduled_week;
                              if (existing && existing !== row.scheduledWeek) {
                                return (
                                  <Badge className="ml-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-[9px]">
                                    Overwrites: Week of {format(parseISO(existing), "MMM d")}
                                  </Badge>
                                );
                              }
                              return null;
                            })()}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.isPriority && (
                              <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-[9px]">
                                Priority
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.inspectorMatched ? (
                              <span>{inspectors.find((i) => i.id === row.inspectorId)?.name ?? "—"}</span>
                            ) : row.inspectorName ? (
                              <Select
                                value="__none__"
                                onValueChange={(val) => val !== "__none__" && handleManualInspectorFix(row.rowIdx, val)}
                              >
                                <SelectTrigger className="h-7 text-xs bg-background border-amber-500/30 w-40">
                                  <SelectValue placeholder={row.inspectorName} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">— Not matched —</SelectItem>
                                  {inspectors.map((insp) => (
                                    <SelectItem key={insp.id} value={insp.id}>{insp.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                  <Button
                    disabled={stats.matched === 0}
                    onClick={() => setStep(3)}
                  >
                    Review & Apply ({stats.matched} buildings)
                  </Button>
                </div>
              </div>
            )}

            {/* ── STEP 3: Confirm & Apply ─────────────────────────────── */}
            {step === 3 && (
              <div className="space-y-4">
                {done ? (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <CheckCircle className="h-16 w-16 text-green-500" />
                    <p className="text-lg font-medium">Schedule Applied Successfully</p>
                    <p className="text-sm text-muted-foreground text-center">
                      {stats.matched} buildings updated, {stats.priority} marked priority, {stats.unmatched} skipped (unmatched)
                    </p>
                    <Button onClick={handleClose}>Done</Button>
                  </div>
                ) : (
                  <>
                    <div className="p-4 rounded-lg bg-muted/30 space-y-2">
                      <p className="font-medium">Ready to apply schedule</p>
                      <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                        <li><span className="font-medium text-foreground">{stats.matched}</span> buildings will be updated with scheduled weeks</li>
                        <li><span className="font-medium text-foreground">{stats.priority}</span> will be marked as priority</li>
                        <li><span className="font-medium text-foreground">{matchedRows.filter((r) => r.inspectorId).length}</span> will have inspectors assigned</li>
                        {stats.unmatched > 0 && (
                          <li><span className="font-medium text-orange-600 dark:text-orange-400">{stats.unmatched}</span> unmatched rows will be skipped</li>
                        )}
                      </ul>
                    </div>

                    <div className="flex justify-between">
                      <Button variant="outline" onClick={() => setStep(2)} disabled={applying}>Back</Button>
                      <Button onClick={handleApply} disabled={applying}>
                        {applying ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-1" /> Applying…
                          </>
                        ) : (
                          "Apply Schedule"
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
