import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
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
import { ArrowLeft, ArrowRight, Check, Loader2, MapPin, AlertTriangle, GripVertical, X, Navigation, ChevronDown, ChevronUp, Trash2, Eye, Smartphone } from "lucide-react";
import { generateClusters, type DayCluster, type ClusterBuilding } from "@/lib/route-clustering";
import type { Tables } from "@/integrations/supabase/types";

type Step = "params" | "generating" | "review" | "saving" | "done";

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  pending: { label: "Pending", badge: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", badge: "bg-info/20 text-info" },
  complete: { label: "Complete", badge: "bg-success/20 text-success" },
  skipped: { label: "Skipped", badge: "bg-warning/20 text-warning" },
  needs_revisit: { label: "Needs Revisit", badge: "bg-destructive/20 text-destructive" },
};

const STATUS_CYCLE: Record<string, string> = {
  pending: "complete",
  complete: "skipped",
  skipped: "needs_revisit",
  needs_revisit: "pending",
  in_progress: "complete",
};

export default function RouteBuilder() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("params");

  // Parameters
  const [clients, setClients] = useState<Tables<"clients">[]>([]);
  const [regions, setRegions] = useState<Tables<"regions">[]>([]);
  const [inspectors, setInspectors] = useState<Tables<"inspectors">[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedInspector, setSelectedInspector] = useState("");
  const [buildingsPerDay, setBuildingsPerDay] = useState(5);
  const [useStartLocation, setUseStartLocation] = useState(false);
  const [startLocation, setStartLocation] = useState("");

  // Results
  const [clusters, setClusters] = useState<DayCluster[]>([]);
  const [unassigned, setUnassigned] = useState<ClusterBuilding[]>([]);
  const [unresolvedZips, setUnresolvedZips] = useState<string[]>([]);

  // Drag state
  const [dragItem, setDragItem] = useState<{ building: ClusterBuilding; fromDay: number | null } | null>(null);

  // Load clients on mount
  useEffect(() => {
    supabase.from("clients").select("*").eq("is_active", true).then(({ data }) => {
      if (data) setClients(data);
    });
  }, []);

  // Load regions when client changes
  useEffect(() => {
    if (!selectedClient) { setRegions([]); return; }
    setSelectedRegion("");
    setSelectedInspector("");
    supabase.from("regions").select("*").eq("client_id", selectedClient).then(({ data }) => {
      if (data) setRegions(data);
    });
  }, [selectedClient]);

  // Load inspectors when region changes
  useEffect(() => {
    if (!selectedRegion) { setInspectors([]); return; }
    setSelectedInspector("");
    supabase.from("inspectors").select("*").eq("region_id", selectedRegion).then(({ data }) => {
      if (data) setInspectors(data);
    });
  }, [selectedRegion]);

  // Generate routes
  const handleGenerate = useCallback(async () => {
    setStep("generating");
    try {
      let query = supabase.from("buildings").select("*").eq("region_id", selectedRegion);
      if (selectedInspector) query = query.eq("inspector_id", selectedInspector);

      const { data: buildings, error } = await query;
      if (error) throw error;
      if (!buildings || buildings.length === 0) {
        toast.error("No buildings found for the selected filters");
        setStep("params");
        return;
      }

      const startLoc = useStartLocation ? startLocation.trim() : undefined;
      const { clusters: generated, unresolved } = await generateClusters(buildings, buildingsPerDay, startLoc);
      setClusters(generated);
      setUnresolvedZips(unresolved);
      setUnassigned([]);
      setStep("review");

      if (unresolved.length > 0) {
        toast.warning(`${unresolved.length} zip code(s) not found in dataset — buildings still included but distance may be approximate`);
      }
      toast.success(`Generated ${generated.length} day(s) from ${buildings.length} buildings`);
    } catch (err: any) {
      console.error(err);
      toast.error(`Generation failed: ${err.message}`);
      setStep("params");
    }
  }, [selectedRegion, selectedInspector, buildingsPerDay, useStartLocation, startLocation]);

  // Drag handlers
  const handleDragStart = (building: ClusterBuilding, fromDay: number | null) => {
    setDragItem({ building, fromDay });
  };

  const handleDrop = (targetDay: number | null) => {
    if (!dragItem) return;
    const { building, fromDay } = dragItem;
    if (fromDay === targetDay) { setDragItem(null); return; }

    setClusters((prev) => {
      const next = prev.map((c) => ({
        ...c,
        buildings: c.buildings.filter((b) => b.id !== building.id),
      }));

      if (targetDay !== null) {
        const dayIdx = next.findIndex((c) => c.dayNumber === targetDay);
        if (dayIdx >= 0) next[dayIdx].buildings.push(building);
      }
      return next;
    });

    if (fromDay === null) {
      setUnassigned((prev) => prev.filter((b) => b.id !== building.id));
    }
    if (targetDay === null) {
      setUnassigned((prev) => [...prev, building]);
    }

    setDragItem(null);
  };

  const handleRemoveFromDay = (building: ClusterBuilding, dayNumber: number) => {
    setClusters((prev) =>
      prev.map((c) =>
        c.dayNumber === dayNumber
          ? { ...c, buildings: c.buildings.filter((b) => b.id !== building.id) }
          : c
      )
    );
    setUnassigned((prev) => [...prev, building]);
  };

  // Save finalized routes
  const handleSave = useCallback(async () => {
    setStep("saving");
    try {
      const clientName = clients.find((c) => c.id === selectedClient)?.name ?? "Plan";
      const regionName = regions.find((r) => r.id === selectedRegion)?.name ?? "";
      const today = new Date().toISOString().split("T")[0];

      const { data: plan, error: planErr } = await supabase
        .from("route_plans")
        .insert({
          client_id: selectedClient,
          region_id: selectedRegion,
          inspector_id: selectedInspector || inspectors[0]?.id,
          name: `${clientName} - ${regionName} - ${today}`,
          start_date: today,
          end_date: today,
          buildings_per_day: buildingsPerDay,
          status: "draft",
        })
        .select("id")
        .single();
      if (planErr) throw planErr;

      for (const cluster of clusters) {
        if (cluster.buildings.length === 0) continue;

        const { data: day, error: dayErr } = await supabase
          .from("route_plan_days")
          .insert({
            route_plan_id: plan.id,
            day_number: cluster.dayNumber,
            day_date: today,
            estimated_distance_miles: cluster.estimatedDistanceMiles,
          })
          .select("id")
          .single();
        if (dayErr) throw dayErr;

        const buildingInserts = cluster.buildings.map((b, i) => ({
          route_plan_day_id: day.id,
          building_id: b.id,
          stop_order: i + 1,
        }));

        const { error: bErr } = await supabase.from("route_plan_buildings").insert(buildingInserts);
        if (bErr) throw bErr;
      }

      setStep("done");
      toast.success("Route plan saved successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error(`Save failed: ${err.message}`);
      setStep("review");
    }
  }, [clusters, selectedClient, selectedRegion, selectedInspector, buildingsPerDay, clients, regions, inspectors]);

  const totalBuildings = clusters.reduce((sum, c) => sum + c.buildings.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Route Builder</h1>
        <p className="text-muted-foreground mt-1">
          Generate optimized daily inspection routes
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {(["Parameters", "Generate", "Review & Adjust", "Save"] as const).map((label, i) => {
          const stepOrder: Step[] = ["params", "generating", "review", "saving"];
          const currentIdx = stepOrder.indexOf(step === "done" ? "saving" : step);
          const isActive = i <= currentIdx;
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <div className={`h-px w-8 ${isActive ? "bg-primary" : "bg-border"}`} />}
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                <span
                  className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isActive ? "bg-primary text-primary-foreground" : "bg-muted-foreground/30 text-muted-foreground"
                  }`}
                >
                  {step === "done" && i === 3 ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                {label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Step 1: Parameters */}
      {step === "params" && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Select Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Client</label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Region</label>
                <Select value={selectedRegion} onValueChange={setSelectedRegion} disabled={!selectedClient}>
                  <SelectTrigger>
                    <SelectValue placeholder={selectedClient ? "Select region" : "Select client first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Inspector (optional)</label>
                <Select value={selectedInspector} onValueChange={setSelectedInspector} disabled={!selectedRegion}>
                  <SelectTrigger>
                    <SelectValue placeholder={selectedRegion ? "All inspectors" : "Select region first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {inspectors.map((ins) => (
                      <SelectItem key={ins.id} value={ins.id}>{ins.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Buildings per day: <span className="text-primary font-bold">{buildingsPerDay}</span>
              </label>
              <Slider
                value={[buildingsPerDay]}
                onValueChange={([v]) => setBuildingsPerDay(v)}
                min={3}
                max={8}
                step={1}
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground">Target number of inspections per day (3–8)</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch
                  id="start-location"
                  checked={useStartLocation}
                  onCheckedChange={setUseStartLocation}
                />
                <Label htmlFor="start-location" className="text-sm font-medium cursor-pointer">
                  <div className="flex items-center gap-1.5">
                    <Navigation className="h-4 w-4" />
                    Set starting location
                  </div>
                </Label>
              </div>
              {useStartLocation && (
                <div className="space-y-1.5">
                  <Input
                    placeholder="Enter zip code or address (e.g. 75050 or 123 Main St, Dallas, TX)"
                    value={startLocation}
                    onChange={(e) => setStartLocation(e.target.value)}
                    className="max-w-md"
                  />
                  <p className="text-xs text-muted-foreground">
                    Routes will be optimized starting from this location each day
                  </p>
                </div>
              )}
            </div>

            <Button onClick={handleGenerate} disabled={!selectedRegion || (useStartLocation && !startLocation.trim())} className="mt-4">
              Generate Routes <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Generating */}
      {step === "generating" && (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
            <p className="text-lg font-medium">Generating routes…</p>
            <p className="text-sm text-muted-foreground mt-1">
              Clustering buildings by geographic proximity
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Review */}
      {step === "review" && (
        <>
          {unresolvedZips.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <div>
                <span className="font-medium">Some zip codes not in dataset:</span>{" "}
                {unresolvedZips.join(", ")} — buildings still included but distance estimates may be less accurate.
              </div>
            </div>
          )}

          <div className="grid gap-4">
            {clusters.map((cluster) => (
              <Card
                key={cluster.dayNumber}
                className="bg-card border-border"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(cluster.dayNumber)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      Day {cluster.dayNumber}
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        {cluster.buildings.length} building{cluster.buildings.length !== 1 ? "s" : ""}
                      </span>
                    </CardTitle>
                    <Badge variant="outline" className="gap-1">
                      <MapPin className="h-3 w-3" />
                      ~{cluster.estimatedDistanceMiles} mi
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {cluster.buildings.map((b) => (
                    <BuildingRow
                      key={b.id}
                      building={b}
                      onDragStart={() => handleDragStart(b, cluster.dayNumber)}
                      onRemove={() => handleRemoveFromDay(b, cluster.dayNumber)}
                    />
                  ))}
                  {cluster.buildings.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Drop buildings here
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Unassigned pool */}
          {unassigned.length > 0 && (
            <Card
              className="bg-muted/50 border-dashed border-border"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(null)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  Unassigned
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    {unassigned.length} building{unassigned.length !== 1 ? "s" : ""}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {unassigned.map((b) => (
                  <BuildingRow
                    key={b.id}
                    building={b}
                    onDragStart={() => handleDragStart(b, null)}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("params")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button onClick={handleSave}>
              <Check className="h-4 w-4 mr-2" /> Finalize {totalBuildings} Buildings in {clusters.filter((c) => c.buildings.length > 0).length} Days
            </Button>
          </div>
        </>
      )}

      {/* Saving */}
      {step === "saving" && (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
            <p className="text-lg font-medium">Saving route plan…</p>
          </CardContent>
        </Card>
      )}

      {/* Done */}
      {step === "done" && (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-primary/10 mb-4">
              <Check className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">Route Plan Saved</h2>
            <p className="text-muted-foreground mt-2">
              {totalBuildings} buildings organized into {clusters.filter((c) => c.buildings.length > 0).length} days
            </p>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => { setStep("params"); setClusters([]); setUnassigned([]); }}>
                Create Another Plan
              </Button>
              <Button onClick={() => { setStep("params"); setClusters([]); setUnassigned([]); }}>
                View Saved Routes ↓
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── SAVED ROUTES ── */}
      <SavedRoutes navigate={navigate} />
    </div>
  );
}

function BuildingRow({
  building,
  onDragStart,
  onRemove,
}: {
  building: ClusterBuilding;
  onDragStart: () => void;
  onRemove?: () => void;
}) {
  const accessLabel: Record<string, string> = {
    roof_hatch: "Hatch",
    exterior_ladder: "Ext. Ladder",
    interior_ladder: "Int. Ladder",
    ground_level: "Ground",
    other: "",
  };

  const displayAccess = building.roof_access_type
    ? (accessLabel[building.roof_access_type] || building.roof_access_type)
    : null;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="flex items-center gap-3 p-3 rounded-md bg-background border border-border hover:border-primary/30 cursor-grab active:cursor-grabbing transition-colors"
    >
      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{building.property_name}</span>
          {building.is_priority && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Priority</Badge>}
          {building.requires_advance_notice && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">24hr Notice</Badge>}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {building.address}, {building.city}, {building.state} {building.zip_code}
        </p>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
        {building.square_footage && (
          <span>{(building.square_footage / 1000).toFixed(0)}k sqft</span>
        )}
        {displayAccess && (
          <Badge variant="outline" className="text-[10px]">
            {displayAccess}
          </Badge>
        )}
      </div>
      {onRemove && (
        <button onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ── SAVED ROUTES COMPONENT ──

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
}

interface SavedDay {
  id: string;
  day_number: number;
  day_date: string;
  estimated_distance_miles: number | null;
  buildings: SavedDayBuilding[];
}

function SavedRoutes({ navigate }: { navigate: (path: string) => void }) {
  const [plans, setPlans] = useState<SavedRoutePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [expandedBuilding, setExpandedBuilding] = useState<string | null>(null);
  const [days, setDays] = useState<SavedDay[]>([]);
  const [hideComplete, setHideComplete] = useState(false);
  const [loadingDays, setLoadingDays] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SavedRoutePlan | null>(null);

  // Status note dialog
  const [noteDialog, setNoteDialog] = useState<{ id: string; status: string } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

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
      .select("route_plan_day_id, stop_order, buildings(id, property_name, address, city, state, zip_code, inspection_status, inspector_notes, is_priority, square_footage, roof_access_type, access_location, lock_gate_codes, special_equipment, special_notes, property_manager_name, property_manager_phone, property_manager_email)")
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
        })),
    }));

    setDays(result);
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

                        {days.map((day) => {
                          const dayComplete = day.buildings.filter((b) => b.inspection_status === "complete").length;
                          const visibleBuildings = hideComplete ? day.buildings.filter((b) => b.inspection_status !== "complete") : day.buildings;
                          if (hideComplete && visibleBuildings.length === 0) return null;
                          return (
                            <div key={day.id} className="space-y-2">
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
                              <div className="space-y-1">
                                {visibleBuildings.map((b) => {
                                  const cfg = STATUS_CONFIG[b.inspection_status] || STATUS_CONFIG.pending;
                                  const isBuildingExpanded = expandedBuilding === b.id;
                                  return (
                                    <div key={b.id} className="rounded-md bg-background border border-border overflow-hidden">
                                      <div className="flex items-center justify-between p-2">
                                        <button
                                          className="flex items-center gap-2 min-w-0 flex-1 text-left"
                                          onClick={() => setExpandedBuilding(isBuildingExpanded ? null : b.id)}
                                        >
                                          <span className="text-xs text-muted-foreground font-mono">#{b.stop_order}</span>
                                          <span className="text-sm font-medium truncate">{b.property_name}</span>
                                          {b.is_priority && <Badge variant="destructive" className="text-[10px] px-1 py-0">P</Badge>}
                                          {isBuildingExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />}
                                        </button>
                                        <Select value={b.inspection_status} onValueChange={(val) => handleStatusChange(b.id, val)}>
                                          <SelectTrigger className={`h-7 w-[130px] text-xs border-0 ${cfg.badge} shrink-0`}>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent className="bg-popover z-50">
                                            {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                                              <SelectItem key={key} value={key} className="text-xs">
                                                {val.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      {isBuildingExpanded && (
                                        <div className="px-3 pb-3 border-t border-border pt-2 space-y-1.5 text-xs">
                                          <div className="text-muted-foreground">{b.address}, {b.city}, {b.state} {b.zip_code}</div>
                                          {b.square_footage && <div><span className="text-muted-foreground">Sq Ft:</span> {b.square_footage.toLocaleString()}</div>}
                                          {b.roof_access_type && <div><span className="text-muted-foreground">Roof Access:</span> {b.roof_access_type.replace(/_/g, " ")}</div>}
                                          {b.access_location && <div><span className="text-muted-foreground">Access Location:</span> {b.access_location}</div>}
                                          {b.lock_gate_codes && <div><span className="text-muted-foreground">Codes:</span> <span className="font-mono">{b.lock_gate_codes}</span></div>}
                                          {b.special_equipment && b.special_equipment.length > 0 && <div><span className="text-muted-foreground">Equipment:</span> {b.special_equipment.join(", ")}</div>}
                                          {b.special_notes && <div><span className="text-muted-foreground">Notes:</span> {b.special_notes}</div>}
                                          {(b.property_manager_name || b.property_manager_phone || b.property_manager_email) && (
                                            <div className="p-1.5 rounded bg-accent/50 space-y-0.5">
                                              <div className="font-medium text-foreground">Property Manager</div>
                                              {b.property_manager_name && <div>{b.property_manager_name}</div>}
                                              {b.property_manager_phone && <div><a href={`tel:${b.property_manager_phone}`} className="text-primary underline">{b.property_manager_phone}</a></div>}
                                              {b.property_manager_email && <div><a href={`mailto:${b.property_manager_email}`} className="text-primary underline">{b.property_manager_email}</a></div>}
                                            </div>
                                          )}
                                          {b.inspector_notes && (
                                            <div className="p-1.5 rounded bg-muted"><span className="text-muted-foreground">Inspector Notes:</span> {b.inspector_notes}</div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
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
