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
  TrendingUp,
  Clock,
  Droplets,
  DollarSign,
  UserCheck,
  ArrowRight,
  Calendar,
  Briefcase,
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
  preventative_budget_estimated: number | null;
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
          "id, square_footage, inspection_status, is_priority, is_deleted, install_year, state, client_id, next_inspection_due, total_leaks_12mo, total_leak_expense_12mo, requires_escort, installer_has_warranty, manufacturer_has_warranty, preventative_budget_estimated"
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

  const maintBuildings = buildings.filter(
    (b) => b.preventative_budget_estimated != null && (b.square_footage ?? 0) > 0
  );
  const totalMaintBudget = maintBuildings.reduce(
    (s, b) => s + (b.preventative_budget_estimated ?? 0), 0
  );
  const totalMaintSqft = maintBuildings.reduce(
    (s, b) => s + (b.square_footage ?? 0), 0
  );
  const maintPer100k = totalMaintSqft > 0
    ? (totalMaintBudget / totalMaintSqft) * 100_000
    : 0;

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
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
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
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">{getGreeting()}, {firstName}</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
      </div>

      {/* Disclaimer */}
      <div className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
        <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span>Displaying <span className="font-medium text-foreground">{totalBuildings.toLocaleString()}</span> buildings across <span className="font-medium text-foreground">{activeClients}</span> active clients — represents a portion of SRC's total managed portfolio</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
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

        {/* Maint. Cost / 100K sqft */}
        <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Maint. Cost / 100K sqft</p>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-500/15">
              <DollarSign className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <p className="text-4xl font-bold text-white leading-none">{fmtMoney(maintPer100k)}</p>
          <p className="text-xs text-slate-500 mt-1">Based on {maintBuildings.length} buildings with data</p>
        </div>
      </div>

      {/* Portfolio by Client + Inspection Status */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {/* Portfolio by Client */}
        <div className="lg:col-span-3 rounded-xl bg-slate-800 border border-slate-700/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Portfolio by Client</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">{clientRows.length} clients shown</p>
            </div>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/10">
              <Briefcase className="w-3.5 h-3.5 text-blue-400" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700/50 hover:bg-transparent">
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Client</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">Buildings</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">Sq Footage</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">Inspected</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">Priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientRows.map(([id, d]) => {
                  const inspPct = d.count > 0 ? Math.round((d.inspected / d.count) * 100) : 0;
                  return (
                    <TableRow key={id} className="border-slate-700/30 cursor-pointer hover:bg-slate-700/50 transition-colors" onClick={() => navigate(`/portfolio?client=${id}`)}>
                      <TableCell className="font-medium text-sm text-slate-200">{d.name}</TableCell>
                      <TableCell className="text-right text-sm text-slate-300 tabular-nums">{d.count}</TableCell>
                      <TableCell className="text-right text-sm text-slate-300 tabular-nums">{fmtArea(d.sqft)}</TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm text-slate-300 tabular-nums">{d.inspected}/{d.count}</span>
                        <span className="ml-1.5 text-[10px] text-slate-500">{inspPct}%</span>
                      </TableCell>
                      <TableCell className="text-right">
                        {d.priority > 0 ? (
                          <span className="inline-flex items-center justify-center rounded-full bg-amber-500/15 text-amber-400 text-xs font-medium px-2 py-0.5 tabular-nums">{d.priority}</span>
                        ) : (
                          <span className="text-sm text-slate-600">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {byClient.size > 8 && (
            <div className="px-5 py-3 border-t border-slate-700/50">
              <Button variant="link" className="px-0 text-xs text-blue-400 hover:text-blue-300" onClick={() => navigate("/portfolio")}>
                View all clients <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          )}
        </div>

        {/* Inspection Status Breakdown */}
        <div className="lg:col-span-2 rounded-xl bg-slate-800 border border-slate-700/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Inspection Status</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">{totalBuildings} total buildings</p>
            </div>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>
          <div className="p-5 space-y-4">
            {statusEntries.map(([status, count]) => {
              const pct = totalBuildings > 0 ? Math.round((count / totalBuildings) * 100) : 0;
              return (
                <div key={status} className="space-y-1.5">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-slate-300 capitalize font-medium">{status.replace(/_/g, " ")}</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-semibold text-white tabular-nums">{count}</span>
                      <span className="text-[10px] text-slate-500">({pct}%)</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-700/80 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${statusColor(status)}`} style={{ width: `${(count / maxStatusCount) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Roof Age + Risk Flags */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Roof Age */}
        <div className="rounded-xl bg-slate-800 border border-slate-700/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Roof Age by Install Year</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Distribution of roof installations</p>
            </div>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-500/10">
              <TrendingUp className="w-3.5 h-3.5 text-violet-400" />
            </div>
          </div>
          <div className="p-5 space-y-3">
            {Object.entries(ageBuckets).map(([label, count]) => {
              const barPct = (count / maxBucket) * 100;
              return (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-slate-300 font-medium">{label}</span>
                    <span className="text-sm text-white font-semibold tabular-nums">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-700/80 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${barPct}%` }} />
                  </div>
                </div>
              );
            })}
            {missingYear > 0 && (
              <p className="text-[10px] text-slate-500 pt-2 flex items-center gap-1">
                <Info className="w-3 h-3" />
                {missingYear} buildings missing install year data
              </p>
            )}
          </div>
        </div>

        {/* Risk Flags */}
        <div className="rounded-xl bg-slate-800 border border-slate-700/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Portfolio Risk Indicators</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Key risk metrics across portfolio</p>
            </div>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/10">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            </div>
          </div>
          <div className="p-5 space-y-1">
            {[
              { label: "Overdue Inspections", value: overdueCount, icon: Clock, iconColor: "text-red-400", iconBg: "bg-red-500/10", highlight: overdueCount > 0 },
              { label: "Active Leak History", value: leakCount, icon: Droplets, iconColor: "text-sky-400", iconBg: "bg-sky-500/10", highlight: false },
              { label: "Total Leak Expense (12mo)", value: fmtMoney(leakExpense), icon: DollarSign, iconColor: "text-amber-400", iconBg: "bg-amber-500/10", highlight: leakExpense > 100_000 },
              { label: "Escort Required", value: escortCount, icon: UserCheck, iconColor: "text-slate-400", iconBg: "bg-slate-500/10", highlight: false },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between py-3 border-b border-slate-700/30 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center ${r.iconBg}`}>
                    <r.icon className={`w-3.5 h-3.5 ${r.iconColor}`} />
                  </div>
                  <span className="text-sm text-slate-300">{r.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold tabular-nums ${r.highlight ? "text-amber-400" : "text-white"}`}>{r.value}</span>
                  {r.highlight && (
                    <span className="inline-flex items-center rounded-full bg-red-500/15 text-red-400 text-[10px] font-semibold px-2 py-0.5">
                      Action needed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Operations Pulse */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Operations Pulse</h2>
            <p className="text-[10px] text-slate-500">Active work across campaigns &amp; jobs</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Active Campaigns */}
          <div className="rounded-xl bg-slate-800 border border-slate-700/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Active Campaigns</h3>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-500/10">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
              </div>
            </div>
            <div className="p-4 space-y-3">
              {campaigns.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No active campaigns.</p>
              ) : (
                campaigns.map((c) => {
                  const pct = c.total_buildings > 0 ? Math.round((c.completed_buildings / c.total_buildings) * 100) : 0;
                  return (
                    <div
                      key={c.id}
                      className="rounded-lg border border-slate-700/50 p-3 cursor-pointer hover:bg-slate-700/30 transition-colors"
                      onClick={() => navigate(`/inspections/campaigns/${c.id}`)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-200">{c.name}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded-full">{c.status}</span>
                      </div>
                      <div className="h-1 rounded-full bg-slate-700 mb-2">
                        <div className="h-1 rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>{c.completed_buildings} / {c.total_buildings} buildings</span>
                        <span>Ends {format(new Date(c.end_date), "MMM d")}</span>
                      </div>
                    </div>
                  );
                })
              )}
              <Button variant="link" className="px-0 text-xs text-blue-400 hover:text-blue-300" onClick={() => navigate("/inspections/campaigns")}>
                View all <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </div>

          {/* CM Jobs Summary */}
          <div className="rounded-xl bg-slate-800 border border-slate-700/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">CM Jobs Summary</h3>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-500/10">
                <Briefcase className="w-3.5 h-3.5 text-amber-400" />
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {Array.from(jobStatusGroups.entries()).map(([status, count]) => (
                  <span key={status} className="inline-flex items-center rounded-full bg-slate-700/60 text-slate-300 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 capitalize">
                    {status.replace(/_/g, " ")} <span className="ml-1 text-white">{count}</span>
                  </span>
                ))}
                {jobStatusGroups.size === 0 && <p className="text-sm text-slate-500">No jobs.</p>}
              </div>
              {recentJobs.length > 0 && (
                <div className="space-y-1 pt-3 border-t border-slate-700/50">
                  {recentJobs.map((j) => (
                    <div key={j.id} className="flex items-center justify-between py-2 rounded-md px-2 hover:bg-slate-700/30 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-200">{j.title}</span>
                        {j.priority !== "normal" && (
                          <span className="inline-flex items-center rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-medium px-2 py-0.5 capitalize">{j.priority}</span>
                        )}
                      </div>
                      {j.due_date && <span className="text-[10px] text-slate-500">{format(new Date(j.due_date), "MMM d")}</span>}
                    </div>
                  ))}
                </div>
              )}
              <Button variant="link" className="px-0 text-xs text-blue-400 hover:text-blue-300" onClick={() => navigate("/ops/jobs")}>
                View all <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
