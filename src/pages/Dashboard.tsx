import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, MapPin, Upload, Users, Clock, Trash2, Loader2, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
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

interface StatsData {
  clients: number;
  regions: number;
  buildings: number;
  inspectors: number;
}

interface RegionRow {
  id: string;
  name: string;
  status: string;
  clients: { name: string } | null;
  building_count: number;
}

interface UploadRow {
  id: string;
  file_name: string;
  row_count: number;
  status: string;
  created_at: string;
  deleted_at: string | null;
  clients: { name: string } | null;
}

export default function Dashboard() {
  const [stats, setStats] = useState<StatsData>({ clients: 0, regions: 0, buildings: 0, inspectors: 0 });
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [deletedUploads, setDeletedUploads] = useState<UploadRow[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<UploadRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const loadData = async () => {
    const [clientsRes, regionsRes, buildingsRes, inspectorsRes] = await Promise.all([
      supabase.from("clients").select("id", { count: "exact", head: true }),
      supabase.from("regions").select("id, name, status, clients(name)"),
      supabase.from("buildings").select("id", { count: "exact", head: true }),
      supabase.from("inspectors").select("id", { count: "exact", head: true }),
    ]);

    setStats({
      clients: clientsRes.count ?? 0,
      regions: regionsRes.data?.length ?? 0,
      buildings: buildingsRes.count ?? 0,
      inspectors: inspectorsRes.count ?? 0,
    });

    if (regionsRes.data) {
      const regionsWithCounts = await Promise.all(
        regionsRes.data.map(async (r: any) => {
          const { count } = await supabase
            .from("buildings")
            .select("id", { count: "exact", head: true })
            .eq("region_id", r.id);
          return { ...r, building_count: count ?? 0 };
        })
      );
      setRegions(regionsWithCounts);
    }

    // Active uploads (not soft-deleted)
    const uploadsRes = await supabase
      .from("uploads")
      .select("id, file_name, row_count, status, created_at, deleted_at, clients(name)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5);
    setUploads((uploadsRes.data as any) ?? []);

    // Recently deleted uploads
    const deletedRes = await supabase
      .from("uploads")
      .select("id, file_name, row_count, status, created_at, deleted_at, clients(name)")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(10);
    setDeletedUploads((deletedRes.data as any) ?? []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteUpload = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      // Soft-delete: set deleted_at timestamp
      const { error } = await supabase
        .from("uploads")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", deleteTarget.id);
      if (error) throw error;

      toast.success(`Deleted ${deleteTarget.file_name}. You can restore it from Recently Deleted.`);
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      console.error("Delete error:", err);
      toast.error(`Delete failed: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async (upload: UploadRow) => {
    setRestoring(upload.id);
    try {
      const { error } = await supabase
        .from("uploads")
        .update({ deleted_at: null })
        .eq("id", upload.id);
      if (error) throw error;

      toast.success(`Restored ${upload.file_name}`);
      await loadData();
    } catch (err: any) {
      console.error("Restore error:", err);
      toast.error(`Restore failed: ${err.message}`);
    } finally {
      setRestoring(null);
    }
  };

  const handlePermanentDelete = async (upload: UploadRow) => {
    setRestoring(upload.id);
    try {
      // Find building IDs for this upload
      const { data: buildings } = await supabase
        .from("buildings")
        .select("id")
        .eq("upload_id", upload.id);

      const buildingIds = buildings?.map((b) => b.id) ?? [];

      if (buildingIds.length > 0) {
        // Delete route_plan_buildings referencing these buildings
        await supabase
          .from("route_plan_buildings")
          .delete()
          .in("building_id", buildingIds);

        // Clean up empty route_plan_days
        const { data: allDays } = await supabase
          .from("route_plan_days")
          .select("id, route_plan_id, route_plan_buildings(id)");

        if (allDays) {
          const emptyDayIds = allDays
            .filter((d: any) => !d.route_plan_buildings || d.route_plan_buildings.length === 0)
            .map((d: any) => d.id);

          if (emptyDayIds.length > 0) {
            await supabase.from("route_plan_days").delete().in("id", emptyDayIds);
          }

          const orphanedPlanIds = [
            ...new Set(
              allDays
                .filter((d: any) => emptyDayIds.includes(d.id))
                .map((d: any) => d.route_plan_id)
            ),
          ];

          for (const planId of orphanedPlanIds) {
            const { count } = await supabase
              .from("route_plan_days")
              .select("id", { count: "exact", head: true })
              .eq("route_plan_id", planId);
            if (count === 0) {
              await supabase.from("route_plans").delete().eq("id", planId);
            }
          }
        }
      }

      // Hard delete the upload (cascade removes buildings)
      const { error } = await supabase.from("uploads").delete().eq("id", upload.id);
      if (error) throw error;

      toast.success(`Permanently deleted ${upload.file_name} and ${buildingIds.length} buildings`);
      await loadData();
    } catch (err: any) {
      console.error("Permanent delete error:", err);
      toast.error(`Delete failed: ${err.message}`);
    } finally {
      setRestoring(null);
    }
  };

  const statCards = [
    { label: "Active Clients", value: stats.clients, icon: Building2, color: "text-primary" },
    { label: "Regions", value: stats.regions, icon: MapPin, color: "text-info" },
    { label: "Buildings", value: stats.buildings, icon: Building2, color: "text-success" },
    { label: "Inspectors", value: stats.inspectors, icon: Users, color: "text-primary" },
  ];

  const statusColor = (s: string) => {
    if (s === "complete") return "bg-success/20 text-success border-success/30";
    if (s === "in_progress") return "bg-primary/20 text-primary border-primary/30";
    return "bg-muted text-muted-foreground border-border";
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Inspection program overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.label} className="bg-card border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p>
                  <p className="text-3xl font-bold mt-1">{s.value}</p>
                </div>
                <div className={`p-2.5 rounded-lg bg-muted ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Region Progress */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Region Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {regions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No regions yet. Upload a spreadsheet to get started.
              </p>
            ) : (
              regions.map((r) => (
                <div key={r.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">{r.name}</span>
                      {r.clients && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {(r.clients as any).name}
                        </span>
                      )}
                    </div>
                    <Badge variant="outline" className={statusColor(r.status)}>
                      {r.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress
                      value={r.status === "complete" ? 100 : r.status === "in_progress" ? 50 : 0}
                      className="h-1.5 flex-1"
                    />
                    <span className="text-xs text-muted-foreground w-20 text-right">
                      {r.building_count} buildings
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Uploads */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Recent Uploads
            </CardTitle>
          </CardHeader>
          <CardContent>
            {uploads.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No uploads yet. Head to the Upload page to import data.
              </p>
            ) : (
              <div className="space-y-3">
                {uploads.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{u.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {u.row_count} rows • {u.clients && (u.clients as any).name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(u)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recently Deleted */}
      {deletedUploads.length > 0 && (
        <Card className="bg-card border-border border-destructive/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              Recently Deleted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {deletedUploads.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                  <div className="flex items-center gap-3">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{u.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {u.row_count} rows • Deleted {u.deleted_at ? timeAgo(u.deleted_at) : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => handleRestore(u)}
                      disabled={restoring === u.id}
                    >
                      {restoring === u.id ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <RotateCcw className="h-3 w-3 mr-1" />
                      )}
                      Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-destructive hover:text-destructive"
                      onClick={() => handlePermanentDelete(u)}
                      disabled={restoring === u.id}
                    >
                      Delete Forever
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete upload?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{deleteTarget?.row_count} buildings</strong> from{" "}
              <strong>{deleteTarget?.file_name}</strong> from active data. You can restore it from
              the Recently Deleted section.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUpload}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
