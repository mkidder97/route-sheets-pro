import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Building2,
  Maximize2,
  Users,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Activity,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BuildingRow {
  id: string;
  square_footage: number | null;
  inspection_status: string;
  is_priority: boolean | null;
  is_deleted: boolean | null;
  install_year: number | null;
  state: string;
  client_id: string;
  next_inspection_due: string | null;
  total_leaks_12mo: number | null;
  total_leak_expense_12mo: number | null;
  requires_escort: boolean | null;
  installer_has_warranty: boolean | null;
  manufacturer_has_warranty: boolean | null;
}

interface ClientRow {
  id: string;
  name: string;
  is_active: boolean;
}

interface CampaignRow {
  id: string;
  name: string;
  status: string;
  completed_buildings: number;
  total_buildings: number;
  end_date: string;
  updated_at: string;
  client_id: string;
}

interface JobRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  client_id: string;
}

interface RegionRow {
  id: string;
  client_id: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function fmtArea(sqft: number): string {
  if (sqft >= 1_000_000) return `${(sqft / 1_000_000).toFixed(1)} M sq ft`;
  if (sqft >= 1_000) return `${Math.round(sqft / 1_000)} K sq ft`;
  return `${sqft.toLocaleString()} sq ft`;
}

function fmtMoney(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  return `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-500",
  complete: "bg-green-500",
  in_progress: "bg-blue-500",
  pending: "bg-amber-500",
  not_started: "bg-muted-foreground/40",
  priority: "bg-red-500",
};

function statusColor(s: string) {
  return STATUS_COLORS[s] ?? "bg-muted-foreground/40";
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [regions, setRegions] = useState<RegionRow[]>([]);

  async function load() {
    setLoading(true);
    setError(null);
    const [bRes, cRes, campRes, jRes, rRes] = await Promise.all([
      supabase
        .from("buildings")
        .select(
          "id, square_footage, inspection_status, is_priority, is_deleted, install_year, state, client_id, next_inspection_due, total_leaks_12mo, total_leak_expense_12mo, requires_escort, installer_has_warranty, manufacturer_has_warranty"
        )
        .or("is_deleted.is.null,is_deleted.eq.false"),
      supabase.from("clients").select("id, name, is_active"),
      supabase
        .from("inspection_campaigns")
        .select("id, name, status, completed_buildings, total_buildings, end_date, updated_at, client_id")
        .neq("status", "completed")
        .order("updated_at", { ascending: false })
        .limit(4),
      supabase.from("cm_jobs").select("id, title, status, priority, due_date, client_id"),
      supabase.from("regions").select("id, client_id"),
    ]);

    if (bRes.error || cRes.error || campRes.error || jRes.error || rRes.error) {
      setError("Failed to load dashboard data.");
      setLoading(false);
      return;
    }

    setBuildings(bRes.data as BuildingRow[]);
    setClients(cRes.data as ClientRow[]);
    setCampaigns(campRes.data as CampaignRow[]);
    setJobs(jRes.data as JobRow[]);
    setRegions(rRes.data as RegionRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  /* ---- derived data ---- */
  const firstName = profile?.full_name?.split(" ")[0] || "there";
  const totalBuildings = buildings.length;
  const totalArea = buildings.reduce((s, b) => s + (b.square_footage ?? 0), 0);
  const avgArea = totalBuildings > 0 ? Math.round(totalArea / totalBuildings) : 0;
  const uniqueStates = new Set(buildings.map((b) => b.state)).size;
  const activeClients = clients.filter((c) => c.is_active).length;
  const regionCount = regions.length;
  const priorityCount = buildings.filter((b) => b.is_priority).length;
  const priorityPct = totalBuildings > 0 ? Math.round((priorityCount / totalBuildings) * 100) : 0;
  const completedCount = buildings.filter((b) => b.inspection_status === "completed" || b.inspection_status === "complete").length;
  const inspectionPct = totalBuildings > 0 ? Math.round((completedCount / totalBuildings) * 100) : 0;
  const warrantyCount = buildings.filter((b) => b.installer_has_warranty || b.manufacturer_has_warranty).length;
  const warrantyPct = totalBuildings > 0 ? Math.round((warrantyCount / totalBuildings) * 100) : 0;

  /* portfolio by client */
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));
  const byClient = new Map<string, { name: string; count: number; sqft: number; inspected: number; priority: number }>();
  buildings.forEach((b) => {
    const entry = byClient.get(b.client_id) ?? { name: clientMap.get(b.client_id) ?? "Unknown", count: 0, sqft: 0, inspected: 0, priority: 0 };
    entry.count++;
    entry.sqft += b.square_footage ?? 0;
    if (b.inspection_status === "completed" || b.inspection_status === "complete") entry.inspected++;
    if (b.is_priority) entry.priority++;
    byClient.set(b.client_id, entry);
  });
  const clientRows = Array.from(byClient.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8);

  /* inspection status breakdown */
  const statusGroups = new Map<string, number>();
  buildings.forEach((b) => {
    const s = b.inspection_status || "not_started";
    statusGroups.set(s, (statusGroups.get(s) ?? 0) + 1);
  });
  const statusEntries = Array.from(statusGroups.entries()).sort((a, b) => b[1] - a[1]);
  const maxStatusCount = Math.max(...statusEntries.map((e) => e[1]), 1);

  /* roof age buckets */
  const ageBuckets: Record<string, number> = { "Pre-2000": 0, "2000-2009": 0, "2010-2014": 0, "2015-2019": 0, "2020-2024": 0, "2025+": 0 };
  let missingYear = 0;
  buildings.forEach((b) => {
    if (!b.install_year) { missingYear++; return; }
    if (b.install_year < 2000) ageBuckets["Pre-2000"]++;
    else if (b.install_year < 2010) ageBuckets["2000-2009"]++;
    else if (b.install_year < 2015) ageBuckets["2010-2014"]++;
    else if (b.install_year < 2020) ageBuckets["2015-2019"]++;
    else if (b.install_year < 2025) ageBuckets["2020-2024"]++;
    else ageBuckets["2025+"]++;
  });
  const maxBucket = Math.max(...Object.values(ageBuckets), 1);

  /* risk flags */
  const today = new Date().toISOString().split("T")[0];
  const overdueCount = buildings.filter((b) => b.next_inspection_due && b.next_inspection_due < today).length;
  const leakCount = buildings.filter((b) => (b.total_leaks_12mo ?? 0) > 0).length;
  const leakExpense = buildings.reduce((s, b) => s + (Number(b.total_leak_expense_12mo) || 0), 0);
  const escortCount = buildings.filter((b) => b.requires_escort).length;

  /* cm jobs */
  const jobStatusGroups = new Map<string, number>();
  jobs.forEach((j) => jobStatusGroups.set(j.status, (jobStatusGroups.get(j.status) ?? 0) + 1));
  const recentJobs = jobs.slice(0, 3);

  /* ---- render ---- */
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Skeleton className="lg:col-span-3 h-64" />
          <Skeleton className="lg:col-span-2 h-64" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={load}>Retry</Button>
      </div>
    );
  }
  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">{getGreeting()}, {firstName}</h1>
        <p className="text-muted-foreground">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
      </div>

      {/* Disclaimer */}
      <div className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
        <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span>Displaying <span className="font-medium text-foreground">{totalBuildings.toLocaleString()}</span> buildings across <span className="font-medium text-foreground">{activeClients}</span> active clients — represents a portion of SRC's total managed portfolio</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Buildings */}
        <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Total Buildings</p>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-500/15">
              <Building2 className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <p className="text-4xl font-bold text-white leading-none">{totalBuildings.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">Across {uniqueStates} states</p>
        </div>

        {/* Total Area Managed */}
        <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Total Area Managed</p>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-violet-500/15">
              <Maximize2 className="w-4 h-4 text-violet-400" />
            </div>
          </div>
          <p className="text-4xl font-bold text-white leading-none">{fmtArea(totalArea)}</p>
          <p className="text-xs text-slate-500 mt-1">Avg {avgArea.toLocaleString()} sq ft per building</p>
        </div>

        {/* Active Clients */}
        <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Active Clients</p>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-500/15">
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <p className="text-4xl font-bold text-white leading-none">{activeClients}</p>
          <p className="text-xs text-slate-500 mt-1">Across {regionCount} regions</p>
        </div>

        {/* Priority Buildings */}
        <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Priority Buildings</p>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-500/15">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <p className={`text-4xl font-bold leading-none ${priorityCount > 0 ? "text-amber-400" : "text-white"}`}>{priorityCount}</p>
          <p className="text-xs text-slate-500 mt-1">{priorityPct}% of portfolio</p>
        </div>

        {/* Inspection Completion */}
        <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Inspection Completion</p>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-500/15">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <p className="text-4xl font-bold text-white leading-none">{inspectionPct}%</p>
          <div className="mt-2 h-1 rounded-full bg-slate-700">
            <div className="h-1 rounded-full bg-emerald-500" style={{ width: `${inspectionPct}%` }} />
          </div>
          <p className="text-xs text-slate-500 mt-1">{completedCount} of {totalBuildings} complete</p>
        </div>

        {/* Warranty Coverage */}
        <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Warranty Coverage</p>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-sky-500/15">
              <Shield className="w-4 h-4 text-sky-400" />
            </div>
          </div>
          <p className="text-4xl font-bold text-white leading-none">{warrantyPct}%</p>
          <p className="text-xs text-slate-500 mt-1">{warrantyCount} buildings covered</p>
        </div>
      </div>

      {/* Portfolio by Client + Inspection Status */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Portfolio by Client */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Portfolio by Client</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Buildings</TableHead>
                  <TableHead className="text-right">Sq Footage</TableHead>
                  <TableHead className="text-right">Inspected</TableHead>
                  <TableHead className="text-right">Priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientRows.map(([id, d]) => (
                  <TableRow key={id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/portfolio?client=${id}`)}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="text-right">{d.count}</TableCell>
                    <TableCell className="text-right">{fmtArea(d.sqft)}</TableCell>
                    <TableCell className="text-right">{d.inspected} / {d.count}</TableCell>
                    <TableCell className="text-right">{d.priority}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {byClient.size > 8 && (
              <Button variant="link" className="mt-2 px-0 text-xs" onClick={() => navigate("/portfolio")}>
                View all clients →
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Inspection Status Breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Inspection Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {statusEntries.map(([status, count]) => {
              const pct = totalBuildings > 0 ? Math.round((count / totalBuildings) * 100) : 0;
              return (
                <div key={status} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize">{status.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${statusColor(status)}`} style={{ width: `${(count / maxStatusCount) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Roof Age + Risk Flags */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Roof Age */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Roof Age by Install Year</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(ageBuckets).map(([label, count]) => (
              <div key={label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{label}</span>
                  <span className="text-muted-foreground">{count}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(count / maxBucket) * 100}%` }} />
                </div>
              </div>
            ))}
            {missingYear > 0 && (
              <p className="text-xs text-muted-foreground pt-1">{missingYear} buildings missing install year data</p>
            )}
          </CardContent>
        </Card>

        {/* Risk Flags */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Portfolio Risk Indicators</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Overdue Inspections", value: overdueCount, badge: overdueCount > 0 ? "destructive" as const : undefined },
              { label: "Active Leak History", value: leakCount },
              { label: "Total Leak Expense (12mo)", value: fmtMoney(leakExpense), badge: leakExpense > 100_000 ? "secondary" as const : undefined, badgeColor: leakExpense > 100_000 ? "text-amber-500" : undefined },
              { label: "Escort Required", value: escortCount },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm">{r.label}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${r.badgeColor ?? ""}`}>{r.value}</span>
                  {r.badge && <Badge variant={r.badge} className="text-xs">{r.badge === "destructive" ? "Action needed" : "Review"}</Badge>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Operations Pulse */}
      <div>
        <div className="mb-4 border-b border-border pb-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Operations Pulse</h2>
          </div>
          <p className="text-xs text-muted-foreground">Active work across campaigns &amp; jobs</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Campaigns */}
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active campaigns.</p>
              ) : (
                campaigns.map((c) => {
                  const pct = c.total_buildings > 0 ? Math.round((c.completed_buildings / c.total_buildings) * 100) : 0;
                  return (
                    <div
                      key={c.id}
                      className="space-y-1.5 cursor-pointer rounded-md border border-border p-3 hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/inspections/campaigns/${c.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{c.name}</span>
                        <Badge variant="outline" className="text-xs">{c.status}</Badge>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{c.completed_buildings} / {c.total_buildings} buildings</span>
                        <span>Ends {format(new Date(c.end_date), "MMM d")}</span>
                      </div>
                    </div>
                  );
                })
              )}
              <Button variant="link" className="px-0 text-xs" onClick={() => navigate("/inspections/campaigns")}>
                View all →
              </Button>
            </CardContent>
          </Card>

          {/* CM Jobs Summary */}
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">CM Jobs Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {Array.from(jobStatusGroups.entries()).map(([status, count]) => (
                  <Badge key={status} variant="secondary" className="capitalize">
                    {status.replace(/_/g, " ")} ({count})
                  </Badge>
                ))}
                {jobStatusGroups.size === 0 && <p className="text-sm text-muted-foreground">No jobs.</p>}
              </div>
              {recentJobs.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border">
                  {recentJobs.map((j) => (
                    <div key={j.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span>{j.title}</span>
                        {j.priority !== "normal" && <Badge variant="outline" className="text-xs capitalize">{j.priority}</Badge>}
                      </div>
                      {j.due_date && <span className="text-xs text-muted-foreground">{format(new Date(j.due_date), "MMM d")}</span>}
                    </div>
                  ))}
                </div>
              )}
              <Button variant="link" className="px-0 text-xs" onClick={() => navigate("/ops/jobs")}>
                View all →
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
