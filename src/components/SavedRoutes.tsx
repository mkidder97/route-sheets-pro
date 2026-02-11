import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MapPin, ChevronDown, ChevronUp, Trash2, Check, Navigation, SkipForward, AlertTriangle, FileText, FileSpreadsheet } from "lucide-react";
import { generateInspectorPDF, type DayData, type BuildingData, type DocumentMetadata } from "@/lib/pdf-generator";
import { generateInspectorExcel } from "@/lib/excel-generator";
import * as XLSX from "xlsx";

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  pending: { label: "Pending", badge: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", badge: "bg-info/20 text-info" },
  complete: { label: "Complete", badge: "bg-success/20 text-success" },
  skipped: { label: "Skipped", badge: "bg-warning/20 text-warning" },
  needs_revisit: { label: "Needs Revisit", badge: "bg-destructive/20 text-destructive" },
};

interface SavedRoutePlan {
  id: string;
  name: string;
  created_at: string;
  buildings_per_day: number;
  clients: { name: string } | null;
  regions: { name: string } | null;
  inspectors: { name: string } | null;
}

interface SavedDayBuilding {
  id: string;
  property_name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  inspection_status: string;
  inspector_notes: string | null;
  is_priority: boolean | null;
  stop_order: number;
  square_footage: number | null;
  roof_access_type: string | null;
  access_location: string | null;
  lock_gate_codes: string | null;
  special_equipment: string[] | null;
  special_notes: string | null;
  property_manager_name: string | null;
  property_manager_phone: string | null;
  property_manager_email: string | null;
  requires_advance_notice: boolean | null;
  requires_escort: boolean | null;
}

interface SavedDay {
  id: string;
  day_number: number;
  day_date: string;
  estimated_distance_miles: number | null;
  buildings: SavedDayBuilding[];
}

export default function SavedRoutes({ inspectorId }: { inspectorId?: string }) {
  const [plans, setPlans] = useState<SavedRoutePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [expandedBuilding, setExpandedBuilding] = useState<string | null>(null);
  const [days, setDays] = useState<SavedDay[]>([]);
  const [hideComplete, setHideComplete] = useState(false);
  const [loadingDays, setLoadingDays] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SavedRoutePlan | null>(null);

  // Status note dialog
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const dayPickerRef = useRef<HTMLDivElement>(null);

  // Status note dialog
  const [noteDialog, setNoteDialog] = useState<{ id: string; status: string } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const openNavigation = (address: string, city: string, state: string, zipCode: string) => {
    const addr = encodeURIComponent(`${address}, ${city}, ${state} ${zipCode}`);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS
      ? `maps://maps.apple.com/?daddr=${addr}`
      : `https://www.google.com/maps/dir/?api=1&destination=${addr}`;
    window.open(url, "_blank");
  };


  useEffect(() => {
    setExpandedPlan(null);
    setExpandedBuilding(null);
    setSelectedDayIndex(0);
    setDays([]);
    loadPlans();
  }, [inspectorId]);

  useEffect(() => {
    if (dayPickerRef.current && days.length > 0) {
      const selectedChip = dayPickerRef.current.children[selectedDayIndex] as HTMLElement;
      if (selectedChip) {
        selectedChip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [selectedDayIndex, days.length]);

  const loadPlans = async () => {
    let query = supabase
      .from("route_plans")
      .select("id, name, created_at, buildings_per_day, clients(name), regions(name), inspectors(name)");
    if (inspectorId) {
      query = query.eq("inspector_id", inspectorId);
    }
    const { data } = await query
      .order("created_at", { ascending: false })
      .limit(50);
    setPlans((data as SavedRoutePlan[]) || []);
    setLoading(false);
  };

  const toggleExpand = async (planId: string) => {
    if (expandedPlan === planId) {
      setExpandedPlan(null);
      setSelectedDayIndex(0);
      return;
    }
    setExpandedPlan(planId);
    setLoadingDays(true);

    const { data: dayRows } = await supabase
      .from("route_plan_days")
      .select("id, day_number, day_date, estimated_distance_miles")
      .eq("route_plan_id", planId)
      .order("day_number");

    if (!dayRows || dayRows.length === 0) {
      setDays([]);
      setLoadingDays(false);
      return;
    }

    const dayIds = dayRows.map((d) => d.id);
    const { data: rpb } = await supabase
      .from("route_plan_buildings")
      .select("route_plan_day_id, stop_order, buildings(id, property_name, address, city, state, zip_code, inspection_status, inspector_notes, is_priority, square_footage, roof_access_type, access_location, lock_gate_codes, special_equipment, special_notes, property_manager_name, property_manager_phone, property_manager_email, requires_advance_notice, requires_escort)")
      .in("route_plan_day_id", dayIds)
      .order("stop_order");

    const result: SavedDay[] = dayRows.map((d) => ({
      id: d.id,
      day_number: d.day_number,
      day_date: d.day_date,
      estimated_distance_miles: d.estimated_distance_miles ? Number(d.estimated_distance_miles) : null,
      buildings: ((rpb || []) as any[])
        .filter((r) => r.route_plan_day_id === d.id)
        .map((r) => ({
          id: r.buildings.id,
          property_name: r.buildings.property_name,
          address: r.buildings.address,
          city: r.buildings.city,
          state: r.buildings.state,
          zip_code: r.buildings.zip_code,
          inspection_status: r.buildings.inspection_status || "pending",
          inspector_notes: r.buildings.inspector_notes,
          is_priority: r.buildings.is_priority,
          stop_order: r.stop_order,
          square_footage: r.buildings.square_footage,
          roof_access_type: r.buildings.roof_access_type,
          access_location: r.buildings.access_location,
          lock_gate_codes: r.buildings.lock_gate_codes,
          special_equipment: r.buildings.special_equipment,
          special_notes: r.buildings.special_notes,
          property_manager_name: r.buildings.property_manager_name,
          property_manager_phone: r.buildings.property_manager_phone,
          property_manager_email: r.buildings.property_manager_email,
          requires_advance_notice: r.buildings.requires_advance_notice,
          requires_escort: r.buildings.requires_escort,
        })),
    }));

    setDays(result);
    const firstIncompleteIdx = result.findIndex(d => d.buildings.some(b => b.inspection_status !== "complete"));
    setSelectedDayIndex(firstIncompleteIdx >= 0 ? firstIncompleteIdx : 0);
    setLoadingDays(false);
  };

  const handleStatusChange = (buildingId: string, newStatus: string) => {
    if (newStatus === "skipped" || newStatus === "needs_revisit") {
      setNoteDialog({ id: buildingId, status: newStatus });
      setNoteText("");
    } else {
      updateStatus(buildingId, newStatus);
    }
  };

  const updateStatus = async (id: string, status: string, notes?: string) => {
    setSaving(true);
    const update: Record<string, unknown> = {
      inspection_status: status,
      completion_date: status === "complete" ? new Date().toISOString() : null,
    };
    if (notes !== undefined) update.inspector_notes = notes;

    const { error } = await supabase.from("buildings").update(update).eq("id", id);
    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success(`Updated to ${STATUS_CONFIG[status]?.label || status}`);
      setDays((prev) =>
        prev.map((d) => ({
          ...d,
          buildings: d.buildings.map((b) =>
            b.id === id
              ? { ...b, inspection_status: status, inspector_notes: (notes ?? b.inspector_notes) }
              : b
          ),
        }))
      );

      // Auto-advance to next pending building after marking complete
      if (status === "complete") {
        setTimeout(() => {
          setDays(currentDays => {
            const currentDay = currentDays[selectedDayIndex];
            if (currentDay) {
              const currentIdx = currentDay.buildings.findIndex(b => b.id === id);
              const nextPending = currentDay.buildings.find(
                (b, idx) => idx > currentIdx && b.inspection_status !== "complete"
              );
              if (nextPending) {
                setExpandedBuilding(nextPending.id);
              } else {
                setExpandedBuilding(null);
              }
            }
            return currentDays;
          });
        }, 150);
      }
    }
    setSaving(false);
    setNoteDialog(null);
    setNoteText("");
  };

  const handleExport = async (plan: SavedRoutePlan, format: "pdf" | "excel") => {
    setExporting(true);
    try {
      const { data: dayRows } = await supabase
        .from("route_plan_days")
        .select("*")
        .eq("route_plan_id", plan.id)
        .order("day_number");

      if (!dayRows || dayRows.length === 0) {
        toast.error("No route data to export");
        setExporting(false);
        return;
      }

      const daysData: DayData[] = [];
      for (const day of dayRows) {
        const { data: rpb } = await supabase
          .from("route_plan_buildings")
          .select("*, buildings(*)")
          .eq("route_plan_day_id", day.id)
          .order("stop_order");

        const buildings: BuildingData[] = ((rpb || []) as any[]).map((r) => ({
          id: r.building_id,
          stop_order: r.stop_order,
          property_name: r.buildings.property_name,
          address: r.buildings.address,
          city: r.buildings.city,
          state: r.buildings.state,
          zip_code: r.buildings.zip_code,
          square_footage: r.buildings.square_footage,
          roof_group: r.buildings.roof_group,
          building_code: r.buildings.building_code,
          roof_access_type: r.buildings.roof_access_type,
          access_location: r.buildings.access_location,
          lock_gate_codes: r.buildings.lock_gate_codes,
          is_priority: r.buildings.is_priority,
          requires_advance_notice: r.buildings.requires_advance_notice,
          requires_escort: r.buildings.requires_escort,
          special_equipment: r.buildings.special_equipment,
          special_notes: r.buildings.special_notes,
          property_manager_name: r.buildings.property_manager_name,
          property_manager_phone: r.buildings.property_manager_phone,
          property_manager_email: r.buildings.property_manager_email,
        }));

        daysData.push({
          day_number: day.day_number,
          day_date: day.day_date,
          estimated_distance_miles: day.estimated_distance_miles ? Number(day.estimated_distance_miles) : null,
          buildings,
        });
      }

      const meta: DocumentMetadata = {
        clientName: (plan.clients as any)?.name || "Client",
        regionName: (plan.regions as any)?.name || "Region",
        inspectorName: (plan.inspectors as any)?.name || "Inspector",
        startDate: daysData[0]?.day_date || new Date().toISOString().split("T")[0],
        endDate: daysData[daysData.length - 1]?.day_date || new Date().toISOString().split("T")[0],
      };

      const safeName = ((plan.inspectors as any)?.name || "Schedule").replace(/[^a-zA-Z0-9]/g, "_");

      if (format === "pdf") {
        const pdf = generateInspectorPDF(daysData, meta);
        pdf.save(`${safeName}_Schedule.pdf`);
      } else {
        const wb = generateInspectorExcel(daysData, meta);
        XLSX.writeFile(wb, `${safeName}_Schedule.xlsx`);
      }

      toast.success(`${format.toUpperCase()} exported successfully`);
    } catch (err: any) {
      console.error(err);
      toast.error(`Export failed: ${err.message}`);
    }
    setExporting(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    // Delete route_plan_buildings, days, then plan
    const { data: dayRows } = await supabase
      .from("route_plan_days")
      .select("id")
      .eq("route_plan_id", deleteTarget.id);
    if (dayRows && dayRows.length > 0) {
      await supabase.from("route_plan_buildings").delete().in("route_plan_day_id", dayRows.map((d) => d.id));
      await supabase.from("route_plan_days").delete().eq("route_plan_id", deleteTarget.id);
    }
    await supabase.from("route_plans").delete().eq("id", deleteTarget.id);
    toast.success("Route deleted");
    setDeleteTarget(null);
    setExpandedPlan(null);
    loadPlans();
  };

  if (loading) return null;
  if (plans.length === 0) return null;

  const allBuildings = days.flatMap((d) => d.buildings);
  const totalComplete = allBuildings.filter((b) => b.inspection_status === "complete").length;

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Saved Routes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {plans.map((plan) => {
            const isExpanded = expandedPlan === plan.id;
            return (
              <div key={plan.id} className="border border-border rounded-lg overflow-hidden">
                <button
                  className="w-full text-left p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                  onClick={() => toggleExpand(plan.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{plan.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {(plan.clients as any)?.name} • {(plan.regions as any)?.name} • {(plan.inspectors as any)?.name || "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <span className="text-xs text-muted-foreground">{new Date(plan.created_at).toLocaleDateString()}</span>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-4">
                    {loadingDays ? (
                      <div className="flex justify-center py-6">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : days.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No days in this route.</p>
                    ) : (
                      <>
                        {/* Overall progress + hide toggle */}
                        <div className="flex items-center gap-3">
                          <Progress value={allBuildings.length > 0 ? (totalComplete / allBuildings.length) * 100 : 0} className="h-2 flex-1" />
                          <span className="text-sm font-medium text-muted-foreground">{totalComplete}/{allBuildings.length} complete</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch id={`hide-complete-${expandedPlan}`} checked={hideComplete} onCheckedChange={setHideComplete} />
                          <Label htmlFor={`hide-complete-${expandedPlan}`} className="text-xs cursor-pointer">Hide completed</Label>
                        </div>

                        {/* Day picker chips */}
                        <div ref={dayPickerRef} className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                          {days.map((day, idx) => {
                            const dayComplete = day.buildings.filter(b => b.inspection_status === "complete").length;
                            const dayTotal = day.buildings.length;
                            const isAllComplete = dayComplete === dayTotal && dayTotal > 0;
                            const isSelected = idx === selectedDayIndex;
                            return (
                              <button
                                key={day.id}
                                onClick={() => setSelectedDayIndex(idx)}
                                className={`flex-shrink-0 min-w-[80px] px-3 py-2 rounded-lg border text-center transition-colors ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : isAllComplete
                                    ? "bg-muted/50 border-border opacity-60"
                                    : "bg-background border-border hover:border-primary/50"
                                }`}
                              >
                                <div className="text-xs font-semibold">
                                  {isAllComplete && <Check className="h-3 w-3 inline mr-1" />}
                                  Day {day.day_number}
                                </div>
                                <div className="text-[10px] opacity-80 mt-0.5">{dayComplete}/{dayTotal}</div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Day summary bar */}
                        {days[selectedDayIndex] && (() => {
                          const day = days[selectedDayIndex];
                          const dayBuildings = day.buildings;
                          const completeCount = dayBuildings.filter(b => b.inspection_status === "complete").length;
                          const advanceNoticeCount = dayBuildings.filter(b => b.requires_advance_notice).length;
                          const escortCount = dayBuildings.filter(b => b.requires_escort).length;
                          const equipmentCount = dayBuildings.filter(b => b.special_equipment && b.special_equipment.length > 0).length;
                          const visibleBuildings = hideComplete ? dayBuildings.filter(b => b.inspection_status !== "complete") : dayBuildings;
                          return (
                            <div className="space-y-2">
                              <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-1">
                                <div className="flex items-center gap-2 text-sm flex-wrap">
                                  <span className="font-semibold">Day {day.day_number}</span>
                                  <span className="text-muted-foreground">·</span>
                                  <span className="text-muted-foreground">{dayBuildings.length} stops</span>
                                  {day.estimated_distance_miles && (
                                    <>
                                      <span className="text-muted-foreground">·</span>
                                      <span className="text-muted-foreground">~{day.estimated_distance_miles} mi</span>
                                    </>
                                  )}
                                  <span className="text-muted-foreground">·</span>
                                  <span className="text-muted-foreground">{completeCount}/{dayBuildings.length} complete</span>
                                </div>
                                {(advanceNoticeCount > 0 || escortCount > 0 || equipmentCount > 0) && (
                                  <div className="flex gap-2 flex-wrap">
                                    {advanceNoticeCount > 0 && (
                                      <Badge className="bg-warning/20 text-warning border-warning/30 text-[10px]">
                                        ⚠️ {advanceNoticeCount} needs 24hr notice
                                      </Badge>
                                    )}
                                    {escortCount > 0 && (
                                      <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px]">
                                        👤 {escortCount} requires escort
                                      </Badge>
                                    )}
                                    {equipmentCount > 0 && (
                                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">
                                        🔧 {equipmentCount} needs equipment
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                              {visibleBuildings.length === 0 && hideComplete ? (
                                <p className="text-xs text-muted-foreground text-center py-2">All buildings complete for this day.</p>
                              ) : (
                              <div className="space-y-1">
                                {visibleBuildings.map((b) => {
                                  const cfg = STATUS_CONFIG[b.inspection_status] || STATUS_CONFIG.pending;
                                  const isBuildingExpanded = expandedBuilding === b.id;
                                  return (
                                    <div key={b.id} className="rounded-md bg-background border border-border overflow-hidden">
                                      <button
                                        className="w-full text-left p-3"
                                        onClick={() => setExpandedBuilding(isBuildingExpanded ? null : b.id)}
                                      >
                                        {/* Row 1: Stop number, name, badges, status, chevron */}
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <span className="text-xs text-muted-foreground font-mono">#{b.stop_order}</span>
                                            <span className="text-sm font-medium truncate">{b.property_name}</span>
                                            {b.is_priority && <Badge variant="destructive" className="text-[10px] px-1 py-0">P</Badge>}
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0 ml-2">
                                            <Badge className={`${cfg.badge} border-0 text-[10px]`}>{cfg.label}</Badge>
                                            {isBuildingExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                                          </div>
                                        </div>
                                        {/* Row 2: Address */}
                                        <div className="text-xs text-muted-foreground mt-1 truncate">
                                          {b.address}, {b.city}
                                        </div>
                                        {/* Row 3: Access code + roof type + sq ft */}
                                        {(b.lock_gate_codes || b.roof_access_type || b.square_footage) && (
                                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                            {b.lock_gate_codes && (
                                              <span className="text-xs font-mono font-bold text-primary">🔑 {b.lock_gate_codes}</span>
                                            )}
                                            {b.roof_access_type && (
                                              <span className="text-[10px] text-muted-foreground">
                                                {b.roof_access_type === "roof_hatch" ? "Roof hatch" :
                                                 b.roof_access_type === "exterior_ladder" ? "Ext. ladder" :
                                                 b.roof_access_type === "interior_ladder" ? "Int. ladder" :
                                                 b.roof_access_type === "ground_level" ? "Ground level" :
                                                 b.roof_access_type.replace(/_/g, " ")}
                                              </span>
                                            )}
                                            {b.square_footage && (
                                              <span className="text-[10px] text-muted-foreground">{b.square_footage.toLocaleString()} SF</span>
                                            )}
                                          </div>
                                        )}
                                        {/* Row 4: Warning badges */}
                                        {(b.requires_advance_notice || b.requires_escort) && (
                                          <div className="flex gap-1.5 mt-1.5">
                                            {b.requires_advance_notice && (
                                              <Badge className="bg-warning/20 text-warning border-warning/30 text-[10px] px-1.5 py-0">24HR NOTICE</Badge>
                                            )}
                                            {b.requires_escort && (
                                              <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px] px-1.5 py-0">ESCORT REQ</Badge>
                                            )}
                                          </div>
                                        )}
                                      </button>
                                      {isBuildingExpanded && (
                                        <div className="px-3 pb-3 border-t border-border pt-3 space-y-3 text-xs">
                                          {/* Full address */}
                                          <div className="text-sm text-muted-foreground">
                                            {b.address}, {b.city}, {b.state} {b.zip_code}
                                          </div>

                                          {/* Access Details */}
                                          {(b.access_location || b.lock_gate_codes || b.roof_access_type) && (
                                            <div className="p-2.5 rounded-lg bg-accent/50 space-y-1.5">
                                              <div className="font-semibold text-foreground text-xs uppercase tracking-wider">Access Details</div>
                                              {b.access_location && (
                                                <div className="text-foreground leading-relaxed">{b.access_location}</div>
                                              )}
                                              {b.lock_gate_codes && (
                                                <div className="flex items-center gap-1.5">
                                                  <span className="text-muted-foreground">Codes:</span>
                                                  <span className="font-mono font-bold text-primary text-sm">{b.lock_gate_codes}</span>
                                                </div>
                                              )}
                                            </div>
                                          )}

                                          {/* Equipment */}
                                          {b.special_equipment && b.special_equipment.length > 0 && (
                                            <div className="flex items-start gap-1.5">
                                              <span className="text-muted-foreground">Equipment:</span>
                                              <span className="text-foreground">{b.special_equipment.join(", ")}</span>
                                            </div>
                                          )}

                                          {/* Special notes */}
                                          {b.special_notes && (
                                            <div className="p-2 rounded bg-muted">
                                              <span className="text-muted-foreground">Notes: </span>
                                              <span className="text-foreground">{b.special_notes}</span>
                                            </div>
                                          )}

                                          {/* Property Manager */}
                                          {(b.property_manager_name || b.property_manager_phone || b.property_manager_email) && (
                                            <div className="p-2.5 rounded-lg bg-accent/50 space-y-1">
                                              <div className="font-semibold text-foreground text-xs uppercase tracking-wider">Property Manager</div>
                                              {b.property_manager_name && <div className="text-foreground">{b.property_manager_name}</div>}
                                              {b.property_manager_phone && (
                                                <div>
                                                  <a href={`tel:${b.property_manager_phone}`} className="text-primary underline">{b.property_manager_phone}</a>
                                                </div>
                                              )}
                                              {b.property_manager_email && (
                                                <div>
                                                  <a href={`mailto:${b.property_manager_email}`} className="text-primary underline">{b.property_manager_email}</a>
                                                </div>
                                              )}
                                            </div>
                                          )}

                                          {/* Inspector notes */}
                                          {b.inspector_notes && (
                                            <div className="p-2 rounded bg-muted">
                                              <span className="text-muted-foreground">Inspector Notes: </span>
                                              <span className="text-foreground">{b.inspector_notes}</span>
                                            </div>
                                          )}

                                          {/* Navigate button */}
                                          <Button
                                            variant="outline"
                                            className="w-full"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openNavigation(b.address, b.city, b.state, b.zip_code);
                                            }}
                                          >
                                            <Navigation className="h-4 w-4 mr-2" /> Navigate
                                          </Button>

                                          {/* Status tap buttons */}
                                          <div className="grid grid-cols-3 gap-2 pt-1">
                                            <Button
                                              className={`h-12 flex-col gap-1 border ${
                                                b.inspection_status === "complete"
                                                  ? "bg-success/30 text-success border-success/50 ring-2 ring-success/30"
                                                  : "bg-success/10 text-success border-success/30 hover:bg-success/20"
                                              }`}
                                              variant="ghost"
                                              disabled={saving}
                                              onClick={(e) => { e.stopPropagation(); handleStatusChange(b.id, "complete"); }}
                                            >
                                              <Check className="h-5 w-5" />
                                              <span className="text-[11px]">Done</span>
                                            </Button>
                                            <Button
                                              className={`h-12 flex-col gap-1 border ${
                                                b.inspection_status === "skipped"
                                                  ? "bg-warning/30 text-warning border-warning/50 ring-2 ring-warning/30"
                                                  : "bg-warning/10 text-warning border-warning/30 hover:bg-warning/20"
                                              }`}
                                              variant="ghost"
                                              disabled={saving}
                                              onClick={(e) => { e.stopPropagation(); handleStatusChange(b.id, "skipped"); }}
                                            >
                                              <SkipForward className="h-5 w-5" />
                                              <span className="text-[11px]">Skip</span>
                                            </Button>
                                            <Button
                                              className={`h-12 flex-col gap-1 border ${
                                                b.inspection_status === "needs_revisit"
                                                  ? "bg-destructive/30 text-destructive border-destructive/50 ring-2 ring-destructive/30"
                                                  : "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"
                                              }`}
                                              variant="ghost"
                                              disabled={saving}
                                              onClick={(e) => { e.stopPropagation(); handleStatusChange(b.id, "needs_revisit"); }}
                                            >
                                              <AlertTriangle className="h-5 w-5" />
                                              <span className="text-[11px]">Revisit</span>
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              )}
                            </div>
                          );
                        })()}
                      </>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" disabled={exporting} onClick={() => handleExport(plan, "pdf")}>
                        {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />} Export PDF
                      </Button>
                      <Button size="sm" variant="outline" disabled={exporting} onClick={() => handleExport(plan, "excel")}>
                        {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />} Export Excel
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(plan)}>
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Note dialog */}
      <Dialog open={!!noteDialog} onOpenChange={(o) => !o && setNoteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {noteDialog?.status === "skipped" ? "Why was this skipped?" : "What needs revisiting?"}
            </DialogTitle>
          </DialogHeader>
          <Textarea placeholder="Enter notes (required)..." value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialog(null)}>Cancel</Button>
            <Button disabled={!noteText.trim() || saving} onClick={() => { if (noteDialog) updateStatus(noteDialog.id, noteDialog.status, noteText.trim()); }}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this route?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.name}" and all its day/building assignments. Building status data is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
