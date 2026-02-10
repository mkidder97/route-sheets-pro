import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Loader2, MapPin, ChevronDown, ChevronUp, Trash2, Smartphone, Check, Navigation } from "lucide-react";

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

export default function SavedRoutes({ navigate }: { navigate: (path: string) => void }) {
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

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    if (dayPickerRef.current && days.length > 0) {
      const selectedChip = dayPickerRef.current.children[selectedDayIndex] as HTMLElement;
      if (selectedChip) {
        selectedChip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [selectedDayIndex, days.length]);

  const loadPlans = async () => {
    const { data } = await supabase
      .from("route_plans")
      .select("id, name, created_at, buildings_per_day, clients(name), regions(name), inspectors(name)")
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
    }
    setSaving(false);
    setNoteDialog(null);
    setNoteText("");
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

                        {/* Selected day's buildings */}
                        {days[selectedDayIndex] && (() => {
                          const day = days[selectedDayIndex];
                          const dayComplete = day.buildings.filter(b => b.inspection_status === "complete").length;
                          const visibleBuildings = hideComplete ? day.buildings.filter(b => b.inspection_status !== "complete") : day.buildings;
                          return (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold">Day {day.day_number}</span>
                                  <span className="text-xs text-muted-foreground">{day.day_date}</span>
                                  {day.estimated_distance_miles && (
                                    <Badge variant="outline" className="text-[10px] gap-1">
                                      <MapPin className="h-3 w-3" />~{day.estimated_distance_miles} mi
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">{dayComplete}/{day.buildings.length}</span>
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

                                          {/* Navigate placeholder */}
                                          <Button variant="outline" className="w-full" disabled>
                                            <Navigation className="h-4 w-4 mr-2" /> Navigate (coming soon)
                                          </Button>

                                          {/* Status dropdown */}
                                          <div className="pt-1">
                                            <Select value={b.inspection_status} onValueChange={(val) => handleStatusChange(b.id, val)}>
                                              <SelectTrigger className={`h-8 text-xs ${cfg.badge}`}>
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent className="bg-popover z-50">
                                                {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                                                  <SelectItem key={key} value={key} className="text-xs">{val.label}</SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
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
                      <Button size="sm" variant="outline" onClick={() => navigate(`/field?plan=${plan.id}`)}>
                        <Smartphone className="h-4 w-4 mr-1" /> Field View
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
