import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ArrowRight, Check, Loader2, MapPin, AlertTriangle, GripVertical, X } from "lucide-react";
import { generateClusters, type DayCluster, type ClusterBuilding } from "@/lib/route-clustering";
import type { Tables } from "@/integrations/supabase/types";

type Step = "params" | "generating" | "review" | "saving" | "done";

export default function RouteBuilder() {
  const [step, setStep] = useState<Step>("params");

  // Parameters
  const [clients, setClients] = useState<Tables<"clients">[]>([]);
  const [regions, setRegions] = useState<Tables<"regions">[]>([]);
  const [inspectors, setInspectors] = useState<Tables<"inspectors">[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedInspector, setSelectedInspector] = useState("");
  const [buildingsPerDay, setBuildingsPerDay] = useState(5);

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

      const { clusters: generated, unresolved } = await generateClusters(buildings, buildingsPerDay);
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
  }, [selectedRegion, selectedInspector, buildingsPerDay]);

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

            <Button onClick={handleGenerate} disabled={!selectedRegion} className="mt-4">
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
            <Button className="mt-6" onClick={() => { setStep("params"); setClusters([]); setUnassigned([]); }}>
              Create Another Plan
            </Button>
          </CardContent>
        </Card>
      )}
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
    other: "Other",
  };

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
        {building.roof_access_type && (
          <Badge variant="outline" className="text-[10px]">
            {accessLabel[building.roof_access_type] ?? building.roof_access_type}
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
