import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, Building2, Users } from "lucide-react";

interface ClientProgress {
  clientId: string;
  clientName: string;
  regions: {
    regionId: string;
    regionName: string;
    total: number;
    complete: number;
    priorityTotal: number;
    priorityComplete: number;
  }[];
}

interface InspectorProgress {
  inspectorId: string;
  inspectorName: string;
  total: number;
  complete: number;
}

interface RevisitBuilding {
  id: string;
  property_name: string;
  address: string;
  city: string;
  inspector_notes: string | null;
  clientName: string;
}

export function CompletionProgress() {
  const [clientProgress, setClientProgress] = useState<ClientProgress[]>([]);
  const [inspectorProgress, setInspectorProgress] = useState<InspectorProgress[]>([]);
  const [revisitBuildings, setRevisitBuildings] = useState<RevisitBuilding[]>([]);

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    // Load all buildings with client/region/inspector info
    const { data: buildings } = await supabase
      .from("buildings")
      .select("id, inspection_status, is_priority, inspector_notes, property_name, address, city, client_id, region_id, inspector_id, clients(name), regions(name), inspectors(name)");

    if (!buildings) return;

    // Client/Region progress
    const clientMap = new Map<string, ClientProgress>();
    for (const b of buildings as any[]) {
      const cid = b.client_id;
      const cname = b.clients?.name || "Unknown";
      if (!clientMap.has(cid)) {
        clientMap.set(cid, { clientId: cid, clientName: cname, regions: [] });
      }
      const cp = clientMap.get(cid)!;
      let region = cp.regions.find((r) => r.regionId === b.region_id);
      if (!region) {
        region = {
          regionId: b.region_id,
          regionName: b.regions?.name || "Unknown",
          total: 0,
          complete: 0,
          priorityTotal: 0,
          priorityComplete: 0,
        };
        cp.regions.push(region);
      }
      region.total++;
      if (b.inspection_status === "complete") region.complete++;
      if (b.is_priority) {
        region.priorityTotal++;
        if (b.inspection_status === "complete") region.priorityComplete++;
      }
    }
    setClientProgress(Array.from(clientMap.values()));

    // Inspector progress
    const inspMap = new Map<string, InspectorProgress>();
    for (const b of buildings as any[]) {
      if (!b.inspector_id) continue;
      if (!inspMap.has(b.inspector_id)) {
        inspMap.set(b.inspector_id, {
          inspectorId: b.inspector_id,
          inspectorName: b.inspectors?.name || "Unknown",
          total: 0,
          complete: 0,
        });
      }
      const ip = inspMap.get(b.inspector_id)!;
      ip.total++;
      if (b.inspection_status === "complete") ip.complete++;
    }
    setInspectorProgress(Array.from(inspMap.values()));

    // Revisit list
    const revisits = (buildings as any[])
      .filter((b) => b.inspection_status === "needs_revisit")
      .map((b) => ({
        id: b.id,
        property_name: b.property_name,
        address: b.address,
        city: b.city,
        inspector_notes: b.inspector_notes,
        clientName: b.clients?.name || "",
      }));
    setRevisitBuildings(revisits);
  };

  const totalPriorityAll = clientProgress.reduce(
    (acc, c) => acc + c.regions.reduce((a, r) => a + r.priorityTotal, 0),
    0
  );
  const completePriorityAll = clientProgress.reduce(
    (acc, c) => acc + c.regions.reduce((a, r) => a + r.priorityComplete, 0),
    0
  );

  return (
    <>
      {/* Per-Client Progress */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Inspection Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {clientProgress.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No building data yet.</p>
          ) : (
            clientProgress.map((cp) =>
              cp.regions.map((r) => {
                const pct = r.total > 0 ? Math.round((r.complete / r.total) * 100) : 0;
                return (
                  <div key={r.regionId} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {cp.clientName} — {r.regionName}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {r.complete}/{r.total} ({pct}%)
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })
            )
          )}

          {totalPriorityAll > 0 && (
            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  Priority Completion
                </span>
                <span className="text-sm text-muted-foreground">
                  {completePriorityAll}/{totalPriorityAll} priorities complete
                </span>
              </div>
              <Progress
                value={totalPriorityAll > 0 ? Math.round((completePriorityAll / totalPriorityAll) * 100) : 0}
                className="h-2 mt-1.5"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-Inspector Progress */}
      {inspectorProgress.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Inspector Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {inspectorProgress.map((ip) => {
              const pct = ip.total > 0 ? Math.round((ip.complete / ip.total) * 100) : 0;
              return (
                <div key={ip.inspectorId} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{ip.inspectorName}</span>
                    <span className="text-sm text-muted-foreground">
                      {ip.complete}/{ip.total} ({pct}%)
                    </span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Needs Revisit Alert */}
      {revisitBuildings.length > 0 && (
        <Card className="bg-card border-border border-destructive/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Needs Revisit
              <Badge variant="destructive" className="ml-1 text-xs">
                {revisitBuildings.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {revisitBuildings.map((b) => (
              <div
                key={b.id}
                className="p-3 rounded-lg bg-destructive/5 border border-destructive/10"
              >
                <div className="font-medium text-sm">{b.property_name}</div>
                <div className="text-xs text-muted-foreground">
                  {b.address}, {b.city} • {b.clientName}
                </div>
                {b.inspector_notes && (
                  <div className="text-xs mt-1 text-destructive">{b.inspector_notes}</div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
