import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  Crosshair,
  Navigation,
  Check,
  SkipForward,
  Undo2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Phone,
  Mail,
  Image as ImageIcon,
  CheckSquare,
  Square,
} from "lucide-react";
import { haversineDistance } from "@/lib/geo-utils";
import { startOfWeek, format, parseISO } from "date-fns";

// ---------- Types ----------

interface RoutePlanBuilding {
  id: string;
  property_name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  latitude: number | null;
  longitude: number | null;
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
  building_code: string | null;
  photo_url: string | null;
  inspection_status: string;
  scheduled_week: string | null;
  is_priority: boolean | null;
  inspector_id: string | null;
  inspector_notes: string | null;
  completion_date: string | null;
  // Route plan metadata
  dayId: string;
  dayNumber: number;
  dayDate: string;
  stopOrder: number;
}

interface RoutePlanOption {
  id: string;
  name: string;
  clientName: string | null;
  regionName: string | null;
}

type Tier = "priority" | "this_week" | "retry" | "overdue" | "backlog" | "complete";

const TIER_CONFIG: Record<Tier, { label: string; emoji: string; borderClass: string; dimmed?: boolean }> = {
  priority: { label: "PRIORITY", emoji: "🔴", borderClass: "border-l-4 border-l-destructive" },
  this_week: { label: "THIS WEEK", emoji: "📅", borderClass: "border-l-4 border-l-info" },
  retry: { label: "RETRY", emoji: "⚠️", borderClass: "border-l-4 border-l-warning" },
  overdue: { label: "OVERDUE", emoji: "⏰", borderClass: "border-l-4 border-l-yellow-500" },
  backlog: { label: "BACKLOG", emoji: "📋", borderClass: "border-l-4 border-l-muted-foreground", dimmed: true },
  complete: { label: "COMPLETE", emoji: "✅", borderClass: "border-l-4 border-l-success" },
};

const VISIBLE_TIERS: Tier[] = ["priority", "this_week", "retry", "overdue", "backlog"];

// ---------- Helpers ----------

function getCurrentWeekMonday(): string {
  return format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

function categorizeBuilding(b: RoutePlanBuilding, currentWeekMonday: string): Tier {
  if (b.inspection_status === "complete") return "complete";
  if (b.inspection_status === "skipped" || b.inspection_status === "needs_revisit") return "retry";
  if (b.is_priority && b.scheduled_week && b.scheduled_week <= currentWeekMonday) return "priority";
  if (b.is_priority && !b.scheduled_week) return "priority";
  if (b.scheduled_week === currentWeekMonday) return "this_week";
  if (b.scheduled_week && b.scheduled_week < currentWeekMonday) return "overdue";
  return "backlog";
}

function formatDistance(miles: number): string {
  if (miles < 0.1) return `${Math.round(miles * 5280)} ft`;
  return `${miles.toFixed(1)} mi`;
}

function openNavigation(address: string, city: string, state: string, zipCode: string) {
  const addr = encodeURIComponent(`${address}, ${city}, ${state} ${zipCode}`);
  const navPref = localStorage.getItem("roofroute_nav_app") || "auto";
  let url: string;
  if (navPref === "google") {
    url = `https://www.google.com/maps/dir/?api=1&destination=${addr}`;
  } else if (navPref === "apple") {
    url = `maps://maps.apple.com/?daddr=${addr}`;
  } else if (navPref === "waze") {
    url = `https://waze.com/ul?q=${addr}&navigate=yes`;
  } else {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    url = isIOS
      ? `maps://maps.apple.com/?daddr=${addr}`
      : `https://www.google.com/maps/dir/?api=1&destination=${addr}`;
  }
  window.open(url, "_blank");
}

// ---------- Component ----------

export default function FieldTodayView({ inspectorId }: { inspectorId: string }) {
  const [loading, setLoading] = useState(true);
  const [planName, setPlanName] = useState<string | null>(null);
  const [plans, setPlans] = useState<RoutePlanOption[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [buildings, setBuildings] = useState<RoutePlanBuilding[]>([]);
  const [expandedBuilding, setExpandedBuilding] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Note dialog
  const [noteDialog, setNoteDialog] = useState<{ buildingId: string; status: string } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);

  // Bulk mode
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Section collapse state — backlog collapsed by default
  const [collapsedSections, setCollapsedSections] = useState<Set<Tier>>(new Set(["backlog"]));

  const currentWeekMonday = useMemo(() => getCurrentWeekMonday(), []);
  const [selectedWeekMonday, setSelectedWeekMonday] = useState<string>(getCurrentWeekMonday());

  // ---------- Route Plan Discovery ----------

  const discoverRoutePlan = useCallback(async (): Promise<string | null> => {
    // Try cached plan first
    const cached = localStorage.getItem("roofroute_active_plan");
    if (cached) {
      const { data } = await supabase
        .from("route_plans")
        .select("id, name, clients(name), regions(name)")
        .eq("id", cached)
        .eq("inspector_id", inspectorId)
        .single();
      if (data) {
        const plan = data as any;
        setPlanName(plan.name);
        setPlans([{
          id: plan.id,
          name: plan.name,
          clientName: plan.clients?.name ?? null,
          regionName: plan.regions?.name ?? null,
        }]);
        return plan.id;
      }
      // Cache invalid — clear it
      localStorage.removeItem("roofroute_active_plan");
    }

    // Find recent route plans for this inspector
    const { data: planRows } = await supabase
      .from("route_plans")
      .select("id, name, clients(name), regions(name)")
      .eq("inspector_id", inspectorId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!planRows || planRows.length === 0) return null;

    const options: RoutePlanOption[] = (planRows as any[]).map(p => ({
      id: p.id,
      name: p.name,
      clientName: p.clients?.name ?? null,
      regionName: p.regions?.name ?? null,
    }));
    setPlans(options);

    // Auto-select if exactly one
    const selected = options[0];
    setPlanName(selected.name);
    localStorage.setItem("roofroute_active_plan", selected.id);
    return selected.id;
  }, [inspectorId]);

  // ---------- Load Buildings ----------

  const loadBuildings = useCallback(async (planId: string) => {
    // Step 1: Get all days for this route plan
    const { data: dayRows, error: dayError } = await supabase
      .from("route_plan_days")
      .select("id, day_number, day_date")
      .eq("route_plan_id", planId)
      .order("day_number");

    if (dayError || !dayRows || dayRows.length === 0) {
      console.error("Failed to load route plan days:", dayError);
      setBuildings([]);
      return;
    }

    // Step 2: Get all buildings through the junction table
    const dayIds = dayRows.map(d => d.id);
    const { data: rpb, error: rpbError } = await supabase
      .from("route_plan_buildings")
      .select("route_plan_day_id, stop_order, buildings(*)")
      .in("route_plan_day_id", dayIds)
      .order("stop_order");

    if (rpbError || !rpb) {
      console.error("Failed to load route plan buildings:", rpbError);
      setBuildings([]);
      return;
    }

    // Step 3: Flatten into RoutePlanBuilding[]
    const dayMap = new Map(dayRows.map(d => [d.id, d]));
    const flattened: RoutePlanBuilding[] = rpb
      .filter((r: any) => r.buildings)
      .map((r: any) => {
        const day = dayMap.get(r.route_plan_day_id);
        return {
          ...r.buildings,
          is_priority: r.buildings.is_priority ?? false,
          dayId: r.route_plan_day_id,
          dayNumber: day?.day_number ?? 0,
          dayDate: day?.day_date ?? "",
          stopOrder: r.stop_order,
        };
      });

    // Feature 3: Filter to buildings assigned to this inspector OR unassigned
    const myBuildings = flattened.filter(b =>
      !b.inspector_id || b.inspector_id === inspectorId
    );
    setBuildings(myBuildings);
  }, []);

  // ---------- Init ----------

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setLoading(true);
      const planId = await discoverRoutePlan();
      if (cancelled) return;
      if (!planId) {
        setActivePlanId(null);
        setLoading(false);
        return;
      }
      setActivePlanId(planId);
      await loadBuildings(planId);
      if (!cancelled) setLoading(false);
      requestGPS();
    };
    init();
    return () => { cancelled = true; };
  }, [inspectorId, discoverRoutePlan, loadBuildings]);

  // ---------- Plan Picker ----------

  const handlePlanChange = useCallback(async (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    setActivePlanId(planId);
    setPlanName(plan.name);
    localStorage.setItem("roofroute_active_plan", planId);
    setLoading(true);
    await loadBuildings(planId);
    setLoading(false);
  }, [plans, loadBuildings]);

  // ---------- GPS ----------

  const requestGPS = useCallback(async () => {
    setGpsLoading(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      });
      setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
      setGpsActive(true);
    } catch {
      setGpsActive(false);
    }
    setGpsLoading(false);
  }, []);

  // ---------- Week Navigation ----------

  const availableWeeks = useMemo(() => {
    const weeks = [...new Set(buildings.map(b => b.scheduled_week).filter(Boolean))] as string[];
    return weeks.sort();
  }, [buildings]);

  const goToPrevWeek = useCallback(() => {
    const idx = availableWeeks.indexOf(selectedWeekMonday);
    if (idx > 0) setSelectedWeekMonday(availableWeeks[idx - 1]);
  }, [availableWeeks, selectedWeekMonday]);

  const goToNextWeek = useCallback(() => {
    const idx = availableWeeks.indexOf(selectedWeekMonday);
    if (idx < availableWeeks.length - 1) setSelectedWeekMonday(availableWeeks[idx + 1]);
  }, [availableWeeks, selectedWeekMonday]);

  // ---------- Categorize & Sort ----------

  const tieredBuildings = useMemo(() => {
    const tiers: Record<Tier, (RoutePlanBuilding & { distance: number | null })[]> = {
      priority: [], this_week: [], retry: [], overdue: [], backlog: [], complete: [],
    };

    for (const b of buildings) {
      const tier = categorizeBuilding(b, selectedWeekMonday);
      let distance: number | null = null;
      if (userLocation && b.latitude != null && b.longitude != null) {
        distance = haversineDistance(userLocation.lat, userLocation.lng, b.latitude, b.longitude);
      }
      tiers[tier].push({ ...b, distance });
    }

    // Sort each tier
    for (const tier of Object.keys(tiers) as Tier[]) {
      tiers[tier].sort((a, b) => {
        if (a.distance != null && b.distance != null) return a.distance - b.distance;
        if (a.distance != null) return -1;
        if (b.distance != null) return 1;
        return (a.address || "").localeCompare(b.address || "");
      });
    }

    return tiers;
  }, [buildings, userLocation, selectedWeekMonday]);

  // ---------- Progress ----------

  const totalCount = buildings.length;
  const completeCount = buildings.filter(b => b.inspection_status === "complete").length;
  const thisWeekTotal = buildings.filter(b => b.scheduled_week === selectedWeekMonday).length;
  const thisWeekDone = buildings.filter(b => b.scheduled_week === selectedWeekMonday && b.inspection_status === "complete").length;
  const progressPct = totalCount > 0 ? Math.round((completeCount / totalCount) * 100) : 0;
  const weekPct = thisWeekTotal > 0 ? Math.round((thisWeekDone / thisWeekTotal) * 100) : 0;

  // ---------- Status Updates (buildings table only) ----------

  const updateStatus = useCallback(async (
    buildingId: string,
    status: string,
    notes?: string,
  ) => {
    setSaving(true);

    const update: Record<string, unknown> = {
      inspection_status: status,
      completion_date: status === "complete" ? new Date().toISOString() : null,
    };
    if (notes !== undefined) update.inspector_notes = notes;

    const { error } = await supabase
      .from("buildings")
      .update(update)
      .eq("id", buildingId);

    if (error) {
      toast.error("Failed to update status");
    } else {
      const label = status === "complete" ? "Complete" : status === "skipped" ? "Skipped" : "Needs Revisit";
      toast.success(`Marked ${label}`);
      setBuildings(prev => prev.map(b =>
        b.id === buildingId
          ? { ...b, inspection_status: status, completion_date: update.completion_date as string | null, inspector_notes: (notes ?? b.inspector_notes) }
          : b
      ));
    }

    setSaving(false);
    setNoteDialog(null);
    setNoteText("");
  }, []);

  const handleQuickDone = useCallback((b: RoutePlanBuilding) => {
    updateStatus(b.id, "complete");
  }, [updateStatus]);

  const handleStatusWithNote = useCallback((b: RoutePlanBuilding, status: string) => {
    if (status === "skipped" || status === "needs_revisit") {
      setNoteDialog({ buildingId: b.id, status });
      setNoteText("");
    } else {
      updateStatus(b.id, status);
    }
  }, [updateStatus]);

  // ---------- Bulk Mode ----------

  const incompleteIds = useMemo(() =>
    buildings.filter(b => b.inspection_status !== "complete").map(b => b.id),
    [buildings]
  );

  const handleBulkComplete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("buildings")
      .update({ inspection_status: "complete", completion_date: now })
      .in("id", Array.from(selectedIds));

    if (error) {
      toast.error("Some updates failed");
    } else {
      toast.success(`${selectedIds.size} buildings marked complete`);
      setBuildings(prev => prev.map(b =>
        selectedIds.has(b.id)
          ? { ...b, inspection_status: "complete", completion_date: now }
          : b
      ));
    }

    setSelectedIds(new Set());
    setBulkMode(false);
    setSaving(false);
  }, [selectedIds]);

  // ---------- Section Toggle ----------

  const toggleSection = useCallback((tier: Tier) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier); else next.add(tier);
      return next;
    });
  }, []);

  // ---------- Render ----------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activePlanId || buildings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No route plan found for this inspector.</p>
          <p className="text-xs text-muted-foreground mt-2">Route plans are created in the Route Builder.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Plan Picker (if multiple) */}
      {plans.length > 1 && (
        <Select value={activePlanId} onValueChange={handlePlanChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select route plan" />
          </SelectTrigger>
          <SelectContent>
            {plans.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}{p.clientName ? ` — ${p.clientName}` : ""}{p.regionName ? ` (${p.regionName})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Header / Progress */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              {planName && (
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{planName}</p>
              )}
              <p className="text-sm font-semibold">
                {completeCount} of {totalCount} complete
              </p>
            </div>
            <div className="flex items-center gap-2">
              {gpsActive && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Crosshair className="h-3 w-3" /> Sorted by distance
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={requestGPS}
                disabled={gpsLoading}
                className="h-8 w-8"
              >
                {gpsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <Progress value={progressPct} className="h-2" />
          {thisWeekTotal > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">This week: {thisWeekDone} of {thisWeekTotal} done</p>
              <Progress value={weekPct} className="h-1.5" />
            </div>
          )}
          {/* Week Navigation */}
          {availableWeeks.length > 0 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToPrevWeek}
                disabled={availableWeeks.indexOf(selectedWeekMonday) <= 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-medium">
                Week of {format(parseISO(selectedWeekMonday), "MMM d, yyyy")}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToNextWeek}
                disabled={availableWeeks.indexOf(selectedWeekMonday) >= availableWeeks.length - 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
          {/* Bulk mode toggle */}
          <div className="flex items-center justify-end">
            <Button
              variant={bulkMode ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setBulkMode(!bulkMode);
                setSelectedIds(new Set());
              }}
              className="text-xs h-7"
            >
              {bulkMode ? <CheckSquare className="h-3 w-3 mr-1" /> : <Square className="h-3 w-3 mr-1" />}
              {bulkMode ? "Cancel Select" : "Select"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk helpers */}
      {bulkMode && (
        <div className="flex items-center gap-3 px-1 text-xs">
          <button
            onClick={() => setSelectedIds(new Set(incompleteIds))}
            className="text-primary underline"
          >
            Select all incomplete
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-muted-foreground underline"
          >
            Deselect all
          </button>
        </div>
      )}

      {/* Tier Sections */}
      {VISIBLE_TIERS.map(tier => {
        const items = tieredBuildings[tier];
        if (items.length === 0) return null;
        const config = TIER_CONFIG[tier];
        const isCollapsed = collapsedSections.has(tier);

        return (
          <Collapsible key={tier} open={!isCollapsed} onOpenChange={() => toggleSection(tier)}>
            <CollapsibleTrigger asChild>
              <button className={`w-full flex items-center justify-between px-3 py-2 rounded-md bg-secondary/50 hover:bg-secondary transition-colors ${config.dimmed ? "opacity-70" : ""}`}>
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span>{config.emoji}</span>
                  <span>{config.label}</span>
                  <Badge variant="outline" className="text-xs">{items.length}</Badge>
                </span>
                {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className={`space-y-2 mt-2 ${config.dimmed ? "opacity-70" : ""}`}>
              {items.map(b => (
                <BuildingCard
                  key={b.id}
                  b={b}
                  tierConfig={config}
                  expanded={expandedBuilding === b.id}
                  onToggleExpand={() => setExpandedBuilding(expandedBuilding === b.id ? null : b.id)}
                  onQuickDone={() => handleQuickDone(b)}
                  onStatusChange={(status) => handleStatusWithNote(b, status)}
                  onNavigate={() => openNavigation(b.address, b.city, b.state, b.zip_code)}
                  bulkMode={bulkMode}
                  selected={selectedIds.has(b.id)}
                  onToggleSelect={() => {
                    setSelectedIds(prev => {
                      const next = new Set(prev);
                      if (next.has(b.id)) next.delete(b.id); else next.add(b.id);
                      return next;
                    });
                  }}
                  saving={saving}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        );
      })}

      {/* Note Dialog */}
      <Dialog open={!!noteDialog} onOpenChange={() => setNoteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{noteDialog?.status === "skipped" ? "Skip Building" : "Mark for Revisit"}</DialogTitle>
            <DialogDescription>Add a note explaining why.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Reason..."
            rows={3}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNoteDialog(null)}>Cancel</Button>
            <Button
              onClick={() => noteDialog && updateStatus(noteDialog.buildingId, noteDialog.status, noteText)}
              disabled={saving}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Complete Sticky Bar */}
      {bulkMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border p-3 flex items-center justify-between shadow-lg">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button onClick={handleBulkComplete} disabled={saving} className="bg-success text-success-foreground hover:bg-success/90">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
            Mark Complete
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------- Building Card Sub-component ----------

interface BuildingCardProps {
  b: RoutePlanBuilding & { distance: number | null };
  tierConfig: { borderClass: string };
  expanded: boolean;
  onToggleExpand: () => void;
  onQuickDone: () => void;
  onStatusChange: (status: string) => void;
  onNavigate: () => void;
  bulkMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  saving: boolean;
}

function BuildingCard({
  b,
  tierConfig,
  expanded,
  onToggleExpand,
  onQuickDone,
  onStatusChange,
  onNavigate,
  bulkMode,
  selected,
  onToggleSelect,
  saving,
}: BuildingCardProps) {
  return (
    <Card className={`${tierConfig.borderClass} overflow-hidden`}>
      <CardContent className="p-3 space-y-2">
        {/* Top row */}
        <div className="flex items-start gap-2">
          {bulkMode && (
            <Checkbox
              checked={selected}
              onCheckedChange={onToggleSelect}
              className="mt-1"
            />
          )}
          <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggleExpand}>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm truncate">{b.property_name}</span>
              {b.is_priority && (
                <Badge className="bg-destructive/20 text-destructive text-[10px] px-1.5 py-0">P</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{b.address}, {b.city}</p>
          </div>
          {b.distance != null && (
            <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
              {formatDistance(b.distance)}
            </span>
          )}
        </div>

        {/* Key info (always visible) */}
        {b.lock_gate_codes && (
          <div className="flex items-center gap-1.5 text-xs">
            <span>🔑</span>
            <span className="font-mono font-bold text-foreground">{b.lock_gate_codes}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {b.roof_access_type && b.roof_access_type !== "other" && (
            <Badge variant="outline" className="text-[10px]">
              {b.roof_access_type.replace(/_/g, " ")}
            </Badge>
          )}
          {b.square_footage && (
            <Badge variant="outline" className="text-[10px]">{b.square_footage.toLocaleString()} SF</Badge>
          )}
          {b.requires_advance_notice && (
            <Badge className="bg-warning/20 text-warning text-[10px]">24HR NOTICE</Badge>
          )}
          {b.requires_escort && (
            <Badge className="bg-warning/20 text-warning text-[10px]">ESCORT REQ</Badge>
          )}
        </div>

        {/* Quick action row */}
        {!bulkMode && (
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" variant="outline" className="h-8 text-xs flex-1" onClick={onNavigate}>
              <Navigation className="h-3 w-3 mr-1" /> Navigate
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs flex-1 bg-success text-success-foreground hover:bg-success/90"
              onClick={onQuickDone}
              disabled={saving || b.inspection_status === "complete"}
            >
              <Check className="h-3 w-3 mr-1" /> Done
            </Button>
          </div>
        )}

        {/* Expanded details */}
        {expanded && (
          <div className="space-y-3 pt-2 border-t border-border">
            {/* Full address */}
            <p className="text-xs text-muted-foreground">
              {b.address}, {b.city}, {b.state} {b.zip_code}
            </p>

            {/* Access Details */}
            {(b.access_location || b.lock_gate_codes || b.roof_access_type) && (
              <div className="bg-secondary/50 rounded-md p-2 space-y-1">
                <p className="text-xs font-semibold">Access Details</p>
                {b.access_location && <p className="text-xs text-muted-foreground">📍 {b.access_location}</p>}
                {b.lock_gate_codes && <p className="text-xs font-mono">🔑 {b.lock_gate_codes}</p>}
                {b.roof_access_type && (
                  <p className="text-xs text-muted-foreground">🪜 {b.roof_access_type.replace(/_/g, " ")}</p>
                )}
              </div>
            )}

            {/* Equipment */}
            {b.special_equipment && b.special_equipment.length > 0 && (
              <div>
                <p className="text-xs font-semibold">Equipment Needed</p>
                <p className="text-xs text-muted-foreground">{b.special_equipment.join(", ")}</p>
              </div>
            )}

            {/* Special notes */}
            {b.special_notes && (
              <div>
                <p className="text-xs font-semibold">Special Notes</p>
                <p className="text-xs text-muted-foreground">{b.special_notes}</p>
              </div>
            )}

            {/* Property Manager */}
            {b.property_manager_name && (
              <div className="space-y-1">
                <p className="text-xs font-semibold">Property Manager</p>
                <p className="text-xs">{b.property_manager_name}</p>
                {b.property_manager_phone && (
                  <a href={`tel:${b.property_manager_phone}`} className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <Phone className="h-3 w-3" /> {b.property_manager_phone}
                  </a>
                )}
                {b.property_manager_email && (
                  <a href={`mailto:${b.property_manager_email}`} className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <Mail className="h-3 w-3" /> {b.property_manager_email}
                  </a>
                )}
              </div>
            )}

            {/* Inspector notes */}
            {b.inspector_notes && (
              <div>
                <p className="text-xs font-semibold">Inspector Notes</p>
                <p className="text-xs text-muted-foreground">{b.inspector_notes}</p>
              </div>
            )}

            {/* CAD */}
            {b.photo_url && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => window.open(b.photo_url!, "_blank")}
              >
                <ImageIcon className="h-3 w-3 mr-1" /> View CAD
              </Button>
            )}

            {/* Full status buttons */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                size="sm"
                className="text-xs bg-success text-success-foreground hover:bg-success/90"
                onClick={onQuickDone}
                disabled={saving || b.inspection_status === "complete"}
              >
                <Check className="h-3 w-3 mr-1" /> Done
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => onStatusChange("skipped")}
                disabled={saving}
              >
                <SkipForward className="h-3 w-3 mr-1" /> Skip
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => onStatusChange("needs_revisit")}
                disabled={saving}
              >
                <Undo2 className="h-3 w-3 mr-1" /> Revisit
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
