import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DollarSign, TrendingUp, BarChart3, ShieldCheck, Droplets,
  AlertTriangle, Star, Layers, Clock, Target, Building2, Activity,
  Wrench, CircleDollarSign, Percent, CalendarClock, ShieldAlert,
} from "lucide-react";

/* ─── Helpers ─── */

function fmtMoney(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${Math.round(val).toLocaleString()}`;
}

function fmtArea(sqft: number): string {
  if (sqft >= 1_000_000) return `${(sqft / 1_000_000).toFixed(1)}M sqft`;
  if (sqft >= 1_000) return `${Math.round(sqft / 1_000)}K sqft`;
  return `${sqft.toLocaleString()} sqft`;
}

const SQFT_SCALES = [
  { label: "Per Building", value: 1, mode: "per_building" as const },
  { label: "Per 50K sqft", value: 50_000, mode: "per_sqft" as const },
  { label: "Per 100K sqft", value: 100_000, mode: "per_sqft" as const },
  { label: "Per 250K sqft", value: 250_000, mode: "per_sqft" as const },
  { label: "Per 1M sqft", value: 1_000_000, mode: "per_sqft" as const },
] as const;

type SqftScale = (typeof SQFT_SCALES)[number];

function scaleMetric(
  totalCost: number,
  totalSqft: number,
  buildingCount: number,
  scale: SqftScale,
): number {
  if (scale.mode === "per_building") {
    return buildingCount > 0 ? totalCost / buildingCount : 0;
  }
  return totalSqft > 0 ? (totalCost / totalSqft) * scale.value : 0;
}

/* ─── KPI Card ─── */

function AnalyticsKpiCard({
  label, value, subtext, icon: Icon, iconBg, iconColor,
}: {
  label: string; value: string; subtext?: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
}) {
  return (
    <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
      </div>
      <p className="text-3xl font-bold text-white leading-none">{value}</p>
      {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
    </div>
  );
}

/* ─── Types ─── */

interface BRow {
  id: string; client_id: string; square_footage: number | null;
  inspection_status: string; is_priority: boolean | null; install_year: number | null;
  state: string; total_leaks_12mo: number | null; total_leak_expense_12mo: number | null;
  requires_escort: boolean | null; installer_has_warranty: boolean | null;
  manufacturer_has_warranty: boolean | null; preventative_budget_estimated: number | null;
  preventative_budget_actual: number | null; next_inspection_due: string | null;
}

interface SRow {
  id: string; building_id: string; section_name: string; roof_system: string | null;
  rating: number | null; lttr_value: number | null; capital_expense_amount: number | null;
  capital_expense_per_sqft: number | null; capital_expense_type: string | null;
  capital_expense_year: number | null; replacement_year: number | null;
  year_installed: number | null; has_manufacturer_warranty: boolean | null;
  warranty_expiration_date: string | null; has_contractor_warranty: boolean | null;
  contractor_warranty_expiration: string | null; has_recover: boolean | null;
}

interface CRow { id: string; name: string; is_active: boolean; }

/* ─── Main Component ─── */

export default function Analytics() {
  const [buildings, setBuildings] = useState<BRow[]>([]);
  const [sections, setSections] = useState<SRow[]>([]);
  const [clients, setClients] = useState<CRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeScale, setActiveScale] = useState<SqftScale>(SQFT_SCALES[1]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bRes, sRes, cRes] = await Promise.all([
        supabase.from("buildings").select(
          "id, client_id, square_footage, inspection_status, is_priority, install_year, state, " +
          "total_leaks_12mo, total_leak_expense_12mo, requires_escort, " +
          "installer_has_warranty, manufacturer_has_warranty, " +
          "preventative_budget_estimated, preventative_budget_actual, next_inspection_due"
        ).or("is_deleted.is.null,is_deleted.eq.false"),
        supabase.from("roof_sections").select(
          "id, building_id, section_name, roof_system, rating, lttr_value, " +
          "capital_expense_amount, capital_expense_per_sqft, capital_expense_type, capital_expense_year, " +
          "replacement_year, year_installed, has_manufacturer_warranty, warranty_expiration_date, " +
          "has_contractor_warranty, contractor_warranty_expiration, has_recover"
        ),
        supabase.from("clients").select("id, name, is_active"),
      ]);
      if (bRes.error) throw bRes.error;
      if (sRes.error) throw sRes.error;
      if (cRes.error) throw cRes.error;
      setBuildings(bRes.data as unknown as BRow[]);
      setSections(sRes.data as unknown as SRow[]);
      setClients(cRes.data as unknown as CRow[]);
    } catch (e: any) {
      setError(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full max-w-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-10 w-full max-w-lg" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  /* ─── Error ─── */
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle className="w-10 h-10 text-slate-500 opacity-40" />
        <p className="text-slate-400 text-sm">{error}</p>
        <button onClick={load} className="px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primary/90">
          Retry
        </button>
      </div>
    );
  }

  const clientMap = new Map(clients.map(c => [c.id, c.name]));
  const currentYear = new Date().getFullYear();
  const today = new Date().toISOString().split("T")[0];
  const currentDate = new Date();

  /* ═══ MAINTENANCE derived ═══ */
  const bWithMaint = buildings.filter(b => b.preventative_budget_estimated != null && (b.square_footage ?? 0) > 0);
  const totalMaintBudget = bWithMaint.reduce((s, b) => s + (b.preventative_budget_estimated ?? 0), 0);
  const totalMaintSqft = bWithMaint.reduce((s, b) => s + (b.square_footage ?? 0), 0);
  const bWithActual = buildings.filter(b => b.preventative_budget_actual != null && (b.square_footage ?? 0) > 0);
  const totalMaintActual = bWithActual.reduce((s, b) => s + (Number(b.preventative_budget_actual) || 0), 0);
  const totalActualSqft = bWithActual.reduce((s, b) => s + (b.square_footage ?? 0), 0);
  const coveragePct = buildings.length > 0 ? Math.round((bWithMaint.length / buildings.length) * 100) : 0;
  const variance = totalMaintBudget - totalMaintActual;

  // By client breakdown
  const maintByClient = new Map<string, { name: string; count: number; sqft: number; budget: number }>();
  bWithMaint.forEach(b => {
    const e = maintByClient.get(b.client_id) ?? { name: clientMap.get(b.client_id) ?? "Unknown", count: 0, sqft: 0, budget: 0 };
    e.count++; e.sqft += b.square_footage ?? 0; e.budget += b.preventative_budget_estimated ?? 0;
    maintByClient.set(b.client_id, e);
  });
  const maintClientRows = [...maintByClient.values()].sort((a, b) =>
    (b.sqft > 0 ? (b.budget / b.sqft) * activeScale.value : 0) - (a.sqft > 0 ? (a.budget / a.sqft) * activeScale.value : 0)
  );

  /* ═══ CAPITAL derived ═══ */
  const sectionsWithSqft = sections.map(s => ({
    ...s,
    sqft: buildings.find(b => b.id === s.building_id)?.square_footage ?? 0,
  }));
  const sWithCapEx = sectionsWithSqft.filter(s => s.capital_expense_amount != null && s.sqft > 0);
  const totalCapEx = sWithCapEx.reduce((sum, s) => sum + (Number(s.capital_expense_amount) || 0), 0);
  const totalCapExSqft = sWithCapEx.reduce((sum, s) => sum + s.sqft, 0);
  const capExBldgCount = new Set(sWithCapEx.map(s => s.building_id)).size;

  const replacementDue1yr = sections.filter(s => s.replacement_year && s.replacement_year <= currentYear + 1).length;
  const replacementDue3yr = sections.filter(s => s.replacement_year && s.replacement_year <= currentYear + 3).length;
  const replacementDue5yr = sections.filter(s => s.replacement_year && s.replacement_year <= currentYear + 5).length;
  const beyondCount = sections.filter(s => s.replacement_year && s.replacement_year > currentYear + 5).length;

  const totalReplacementCost5yr = sWithCapEx
    .filter(s => s.replacement_year && s.replacement_year <= currentYear + 5)
    .reduce((sum, s) => sum + (Number(s.capital_expense_amount) || 0), 0);

  const avgRemainingLife = (() => {
    const valid = sections.filter(s => s.replacement_year && s.replacement_year > currentYear);
    if (!valid.length) return 0;
    return Math.round(valid.reduce((s, sec) => s + (sec.replacement_year! - currentYear), 0) / valid.length);
  })();

  // By expense type
  const byExpType = new Map<string, { count: number; total: number; sqft: number }>();
  sWithCapEx.forEach(s => {
    const t = s.capital_expense_type || "Unspecified";
    const e = byExpType.get(t) ?? { count: 0, total: 0, sqft: 0 };
    e.count++; e.total += Number(s.capital_expense_amount) || 0; e.sqft += s.sqft;
    byExpType.set(t, e);
  });
  const expTypeRows = [...byExpType.entries()].sort((a, b) => b[1].total - a[1].total);

  // Replacement timeline costs
  const costForRange = (min: number, max: number) =>
    sWithCapEx.filter(s => s.replacement_year && s.replacement_year > min && s.replacement_year <= max)
      .reduce((sum, s) => sum + (Number(s.capital_expense_amount) || 0), 0);

  /* ═══ LEAK & RISK derived ═══ */
  const bWithLeaks = buildings.filter(b => (b.total_leaks_12mo ?? 0) > 0);
  const totalLeakExpense = buildings.reduce((s, b) => s + (Number(b.total_leak_expense_12mo) || 0), 0);
  const totalLeakSqft = bWithLeaks.reduce((s, b) => s + (b.square_footage ?? 0), 0);
  const totalLeaks = buildings.reduce((s, b) => s + (b.total_leaks_12mo ?? 0), 0);
  const totalAllSqft = buildings.reduce((s, b) => s + (b.square_footage ?? 0), 0);
  const overdueCount = buildings.filter(b => b.next_inspection_due && b.next_inspection_due < today).length;
  const priorityCount = buildings.filter(b => b.is_priority).length;

  // By state
  const byState = new Map<string, { count: number; withLeaks: number; leakExp: number; priority: number; sqft: number }>();
  buildings.forEach(b => {
    const st = b.state || "Unknown";
    const e = byState.get(st) ?? { count: 0, withLeaks: 0, leakExp: 0, priority: 0, sqft: 0 };
    e.count++; e.sqft += b.square_footage ?? 0;
    if ((b.total_leaks_12mo ?? 0) > 0) e.withLeaks++;
    e.leakExp += Number(b.total_leak_expense_12mo) || 0;
    if (b.is_priority) e.priority++;
    byState.set(st, e);
  });
  const stateRows = [...byState.entries()].sort((a, b) => b[1].leakExp - a[1].leakExp);

  /* ═══ CONDITION derived ═══ */
  const sWithRating = sections.filter(s => s.rating != null);
  const avgRating = sWithRating.length > 0
    ? (sWithRating.reduce((s, sec) => s + (sec.rating ?? 0), 0) / sWithRating.length).toFixed(1)
    : "—";
  const ratingBuckets = { "Poor (1-3)": 0, "Fair (4-6)": 0, "Good (7-10)": 0 };
  sWithRating.forEach(s => {
    if ((s.rating ?? 0) <= 3) ratingBuckets["Poor (1-3)"]++;
    else if ((s.rating ?? 0) <= 6) ratingBuckets["Fair (4-6)"]++;
    else ratingBuckets["Good (7-10)"]++;
  });
  const sWithLTTR = sections.filter(s => s.lttr_value != null);
  const avgLTTR = sWithLTTR.length > 0
    ? (sWithLTTR.reduce((s, sec) => s + (Number(sec.lttr_value) || 0), 0) / sWithLTTR.length).toFixed(1)
    : "—";
  const bySystem = new Map<string, { total: number; count: number }>();
  sections.forEach(s => {
    if (!s.roof_system || s.rating == null) return;
    const e = bySystem.get(s.roof_system) ?? { total: 0, count: 0 };
    e.total += s.rating; e.count++;
    bySystem.set(s.roof_system, e);
  });
  const systemRows = [...bySystem.entries()]
    .map(([sys, v]) => ({ sys, avg: v.total / v.count, count: v.count }))
    .sort((a, b) => a.avg - b.avg);

  const ratingColor = (r: number) => r >= 7 ? "text-emerald-400" : r >= 4 ? "text-amber-400" : "text-red-400";
  const ratingBarColor = (r: number) => r >= 7 ? "bg-emerald-500" : r >= 4 ? "bg-amber-500" : "bg-red-500";

  /* ═══ WARRANTY derived ═══ */
  const in12mo = new Date(); in12mo.setMonth(in12mo.getMonth() + 12);
  const in24mo = new Date(); in24mo.setMonth(in24mo.getMonth() + 24);
  const in36mo = new Date(); in36mo.setMonth(in36mo.getMonth() + 36);

  const mfgWarrantyCount = sections.filter(s => s.has_manufacturer_warranty).length;
  const contractorWarrantyCount = sections.filter(s => s.has_contractor_warranty).length;

  const expiring12mo = sections.filter(s =>
    s.warranty_expiration_date && new Date(s.warranty_expiration_date) > currentDate && new Date(s.warranty_expiration_date) <= in12mo
  ).length;
  const expired = sections.filter(s =>
    s.warranty_expiration_date && new Date(s.warranty_expiration_date) < currentDate
  ).length;
  const expiring12to24 = sections.filter(s =>
    s.warranty_expiration_date && new Date(s.warranty_expiration_date) > in12mo && new Date(s.warranty_expiration_date) <= in24mo
  ).length;
  const expiring24to36 = sections.filter(s =>
    s.warranty_expiration_date && new Date(s.warranty_expiration_date) > in24mo && new Date(s.warranty_expiration_date) <= in36mo
  ).length;
  const beyond36 = sections.filter(s =>
    s.warranty_expiration_date && new Date(s.warranty_expiration_date) > in36mo
  ).length;

  const mfgCovPct = sections.length > 0 ? Math.round((mfgWarrantyCount / sections.length) * 100) : 0;
  const contractorCovPct = sections.length > 0 ? Math.round((contractorWarrantyCount / sections.length) * 100) : 0;

  const wPct = (n: number) => sections.length > 0 ? `${Math.round((n / sections.length) * 100)}%` : "0%";

  const scaleLabel = activeScale.mode === "per_building" ? "per building" : `per ${activeScale.label.replace("Per ", "")}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Portfolio Analytics</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {buildings.length.toLocaleString()} buildings · {clients.filter(c => c.is_active).length} active clients
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {SQFT_SCALES.map(s => (
            <button
              key={s.label}
              onClick={() => setActiveScale(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeScale.value === s.value
                  ? "bg-primary text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="maintenance">
        <TabsList className="bg-slate-800 border border-slate-700/50">
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="capital">Capital & Replacement</TabsTrigger>
          <TabsTrigger value="leaks">Leak & Risk</TabsTrigger>
          <TabsTrigger value="condition">Condition</TabsTrigger>
          <TabsTrigger value="warranty">Warranty</TabsTrigger>
        </TabsList>

        {/* ═══ MAINTENANCE TAB ═══ */}
        <TabsContent value="maintenance" className="space-y-6 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <AnalyticsKpiCard
              label="Estimated Maint. Cost"
              value={fmtMoney(scaleMetric(totalMaintBudget, totalMaintSqft, bWithMaint.length, activeScale))}
              subtext={`${bWithMaint.length} buildings with data · ${scaleLabel}`}
              icon={DollarSign} iconBg="bg-amber-500/15" iconColor="text-amber-400"
            />
            <AnalyticsKpiCard
              label="Actual Maint. Cost"
              value={fmtMoney(scaleMetric(totalMaintActual, totalActualSqft, bWithActual.length, activeScale))}
              subtext={`${bWithActual.length} buildings with data · ${scaleLabel}`}
              icon={CircleDollarSign} iconBg="bg-emerald-500/15" iconColor="text-emerald-400"
            />
            <AnalyticsKpiCard
              label="Data Coverage"
              value={`${coveragePct}%`}
              subtext={`${bWithMaint.length} of ${buildings.length} buildings`}
              icon={Target} iconBg="bg-blue-500/15" iconColor="text-blue-400"
            />
            <AnalyticsKpiCard
              label="Est vs Actual Variance"
              value={fmtMoney(Math.abs(variance))}
              subtext={variance >= 0 ? "Over-estimated" : "Under-estimated"}
              icon={TrendingUp}
              iconBg={variance >= 0 ? "bg-emerald-500/15" : "bg-red-500/15"}
              iconColor={variance >= 0 ? "text-emerald-400" : "text-red-400"}
            />
          </div>

          {/* Client breakdown */}
          <div className="rounded-xl bg-slate-800 border border-slate-700/50 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-700/50">
              <p className="text-sm font-semibold text-white">Maintenance Budget by Client</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700/50 hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400">Client</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400 text-right">Buildings</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400 text-right">Total Est. Budget</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400 text-right">Scaled Metric</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400 text-right">Avg / Building</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maintClientRows.map(r => (
                  <TableRow key={r.name} className="border-slate-700/50 hover:bg-slate-700/50">
                    <TableCell className="text-sm text-slate-200">{r.name}</TableCell>
                    <TableCell className="text-sm text-slate-300 text-right">{r.count}</TableCell>
                    <TableCell className="text-sm text-slate-300 text-right">{fmtMoney(r.budget)}</TableCell>
                    <TableCell className="text-sm text-slate-300 text-right">
                      {fmtMoney(scaleMetric(r.budget, r.sqft, r.count, activeScale))}
                    </TableCell>
                    <TableCell className="text-sm text-slate-300 text-right">
                      {fmtMoney(r.count > 0 ? r.budget / r.count : 0)}
                    </TableCell>
                  </TableRow>
                ))}
                {maintClientRows.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-8">No data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ═══ CAPITAL TAB ═══ */}
        <TabsContent value="capital" className="space-y-6 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <AnalyticsKpiCard
              label="Cap Ex Cost"
              value={fmtMoney(scaleMetric(totalCapEx, totalCapExSqft, capExBldgCount, activeScale))}
              subtext={`${sWithCapEx.length} sections · ${scaleLabel}`}
              icon={DollarSign} iconBg="bg-violet-500/15" iconColor="text-violet-400"
            />
            <AnalyticsKpiCard
              label="Avg Remaining Life"
              value={`${avgRemainingLife} yrs`}
              subtext="Scale-independent"
              icon={Clock} iconBg="bg-sky-500/15" iconColor="text-sky-400"
            />
            <AnalyticsKpiCard
              label="Replacements Due (5yr)"
              value={replacementDue5yr.toString()}
              subtext={`${replacementDue1yr} within 1yr`}
              icon={CalendarClock} iconBg="bg-amber-500/15" iconColor="text-amber-400"
            />
            <AnalyticsKpiCard
              label="Projected 5yr Spend"
              value={fmtMoney(totalReplacementCost5yr)}
              subtext="Total, scale-independent"
              icon={TrendingUp} iconBg="bg-red-500/15" iconColor="text-red-400"
            />
          </div>

          {/* Replacement timeline */}
          <div className="rounded-xl bg-slate-800 border border-slate-700/50 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-700/50">
              <p className="text-sm font-semibold text-white">Replacement Timeline</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700/50 hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400">Timeframe</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400 text-right">Sections Due</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400 text-right">Est. Total Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { tf: "Within 1 year", count: replacementDue1yr, cost: costForRange(0, currentYear + 1) },
                  { tf: "Within 3 years", count: replacementDue3yr, cost: costForRange(0, currentYear + 3) },
                  { tf: "Within 5 years", count: replacementDue5yr, cost: costForRange(0, currentYear + 5) },
                  { tf: "Beyond 5 years", count: beyondCount, cost: costForRange(currentYear + 5, 9999) },
                ].map(r => (
                  <TableRow key={r.tf} className="border-slate-700/50 hover:bg-slate-700/50">
                    <TableCell className="text-sm text-slate-200">{r.tf}</TableCell>
                    <TableCell className="text-sm text-slate-300 text-right">{r.count}</TableCell>
                    <TableCell className="text-sm text-slate-300 text-right">{fmtMoney(r.cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* By expense type */}
          <div className="rounded-xl bg-slate-800 border border-slate-700/50 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-700/50">
              <p className="text-sm font-semibold text-white">By Expense Type</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700/50 hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400">Type</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400 text-right">Sections</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400 text-right">Total Cost</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400 text-right">Scaled Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expTypeRows.map(([type, v]) => (
                  <TableRow key={type} className="border-slate-700/50 hover:bg-slate-700/50">
                    <TableCell className="text-sm text-slate-200">{type}</TableCell>
                    <TableCell className="text-sm text-slate-300 text-right">{v.count}</TableCell>
                    <TableCell className="text-sm text-slate-300 text-right">{fmtMoney(v.total)}</TableCell>
                    <TableCell className="text-sm text-slate-300 text-right">
                      {fmtMoney(scaleMetric(v.total, v.sqft, v.count, activeScale))}
                    </TableCell>
                  </TableRow>
                ))}
                {expTypeRows.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-slate-500 py-8">No data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ═══ LEAK & RISK TAB ═══ */}
        <TabsContent value="leaks" className="space-y-6 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <AnalyticsKpiCard
              label="Leak Expense"
              value={fmtMoney(scaleMetric(totalLeakExpense, totalLeakSqft, bWithLeaks.length, activeScale))}
              subtext={`${bWithLeaks.length} buildings with leaks · ${scaleLabel}`}
              icon={Droplets} iconBg="bg-red-500/15" iconColor="text-red-400"
            />
            <AnalyticsKpiCard
              label="Leak Frequency"
              value={
                activeScale.mode === "per_building"
                  ? `${bWithLeaks.length} buildings`
                  : `${totalAllSqft > 0 ? (totalLeaks / totalAllSqft * activeScale.value).toFixed(1) : "0"} leaks`
              }
              subtext={`${totalLeaks} total leaks (12mo)`}
              icon={Activity} iconBg="bg-sky-500/15" iconColor="text-sky-400"
            />
            <AnalyticsKpiCard
              label="Overdue Inspections"
              value={overdueCount.toString()}
              subtext="Past next_inspection_due"
              icon={AlertTriangle}
              iconBg={overdueCount > 0 ? "bg-amber-500/15" : "bg-slate-700/50"}
              iconColor={overdueCount > 0 ? "text-amber-400" : "text-slate-500"}
            />
            <AnalyticsKpiCard
              label="Priority Buildings"
              value={priorityCount.toString()}
              subtext={`${buildings.length > 0 ? Math.round(priorityCount / buildings.length * 100) : 0}% of portfolio`}
              icon={ShieldAlert} iconBg="bg-orange-500/15" iconColor="text-orange-400"
            />
          </div>

          {/* By state */}
          <div className="rounded-xl bg-slate-800 border border-slate-700/50 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-700/50">
              <p className="text-sm font-semibold text-white">Leak & Risk by State</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700/50 hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400">State</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400 text-right">Buildings</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400 text-right">With Leaks</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400 text-right">Leak Expense</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400 text-right">Scaled Cost</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400 text-right">Priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stateRows.map(([st, v]) => (
                  <TableRow key={st} className="border-slate-700/50 hover:bg-slate-700/50">
                    <TableCell className="text-sm text-slate-200 font-medium">{st}</TableCell>
                    <TableCell className="text-sm text-slate-300 text-right">{v.count}</TableCell>
                    <TableCell className="text-sm text-slate-300 text-right">{v.withLeaks}</TableCell>
                    <TableCell className="text-sm text-slate-300 text-right">{fmtMoney(v.leakExp)}</TableCell>
                    <TableCell className="text-sm text-slate-300 text-right">
                      {fmtMoney(scaleMetric(v.leakExp, v.sqft, v.withLeaks, activeScale))}
                    </TableCell>
                    <TableCell className="text-sm text-slate-300 text-right">{v.priority}</TableCell>
                  </TableRow>
                ))}
                {stateRows.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">No data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ═══ CONDITION TAB ═══ */}
        <TabsContent value="condition" className="space-y-6 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <AnalyticsKpiCard
              label="Avg Roof Rating"
              value={`${avgRating} / 10`}
              subtext="Scale-independent"
              icon={Star}
              iconBg={Number(avgRating) >= 7 ? "bg-emerald-500/15" : Number(avgRating) >= 4 ? "bg-amber-500/15" : "bg-red-500/15"}
              iconColor={Number(avgRating) >= 7 ? "text-emerald-400" : Number(avgRating) >= 4 ? "text-amber-400" : "text-red-400"}
            />
            <AnalyticsKpiCard
              label="Poor Condition"
              value={ratingBuckets["Poor (1-3)"].toString()}
              subtext="Sections rated 1–3"
              icon={AlertTriangle} iconBg="bg-red-500/15" iconColor="text-red-400"
            />
            <AnalyticsKpiCard
              label="Avg LTTR Value"
              value={avgLTTR}
              subtext={`${sWithLTTR.length} sections with data`}
              icon={Layers} iconBg="bg-sky-500/15" iconColor="text-sky-400"
            />
            <AnalyticsKpiCard
              label="Sections with Data"
              value={`${sWithRating.length}`}
              subtext={`of ${sections.length} total`}
              icon={BarChart3} iconBg="bg-slate-600/50" iconColor="text-slate-400"
            />
          </div>

          {/* By roof system */}
          <div className="rounded-xl bg-slate-800 border border-slate-700/50 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-700/50">
              <p className="text-sm font-semibold text-white">Avg Rating by Roof System</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700/50 hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400">Roof System</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400 text-right">Sections</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400 text-right">Avg Rating</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400">Rating Bar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {systemRows.map(r => (
                  <TableRow key={r.sys} className="border-slate-700/50 hover:bg-slate-700/50">
                    <TableCell className="text-sm text-slate-200">{r.sys}</TableCell>
                    <TableCell className="text-sm text-slate-300 text-right">{r.count}</TableCell>
                    <TableCell className={`text-sm text-right font-semibold ${ratingColor(r.avg)}`}>
                      {r.avg.toFixed(1)}
                    </TableCell>
                    <TableCell>
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div className={`h-2 rounded-full ${ratingBarColor(r.avg)}`} style={{ width: `${(r.avg / 10) * 100}%` }} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {systemRows.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-slate-500 py-8">No data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Rating distribution */}
          <div className="rounded-xl bg-slate-800 border border-slate-700/50 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-700/50">
              <p className="text-sm font-semibold text-white">Rating Distribution</p>
            </div>
            <div className="p-5 space-y-4">
              {(Object.entries(ratingBuckets) as [string, number][]).map(([bucket, count]) => {
                const pct = sWithRating.length > 0 ? Math.round((count / sWithRating.length) * 100) : 0;
                const color = bucket.includes("Poor") ? "bg-red-500" : bucket.includes("Fair") ? "bg-amber-500" : "bg-emerald-500";
                return (
                  <div key={bucket}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-300">{bucket}</span>
                      <span className="text-slate-400">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-3">
                      <div className={`h-3 rounded-full ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* ═══ WARRANTY TAB ═══ */}
        <TabsContent value="warranty" className="space-y-6 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <AnalyticsKpiCard
              label="Mfg Warranty Coverage"
              value={`${mfgCovPct}%`}
              subtext={`${mfgWarrantyCount} of ${sections.length} sections`}
              icon={ShieldCheck} iconBg="bg-emerald-500/15" iconColor="text-emerald-400"
            />
            <AnalyticsKpiCard
              label="Contractor Coverage"
              value={`${contractorCovPct}%`}
              subtext={`${contractorWarrantyCount} sections`}
              icon={Wrench} iconBg="bg-blue-500/15" iconColor="text-blue-400"
            />
            <AnalyticsKpiCard
              label="Expiring (12mo)"
              value={expiring12mo.toString()}
              subtext="Sections expiring soon"
              icon={CalendarClock}
              iconBg={expiring12mo > 0 ? "bg-amber-500/15" : "bg-slate-700/50"}
              iconColor={expiring12mo > 0 ? "text-amber-400" : "text-slate-500"}
            />
            <AnalyticsKpiCard
              label="Already Expired"
              value={expired.toString()}
              subtext="Past expiration date"
              icon={AlertTriangle}
              iconBg={expired > 0 ? "bg-red-500/15" : "bg-slate-700/50"}
              iconColor={expired > 0 ? "text-red-400" : "text-slate-500"}
            />
          </div>

          {/* Expiration timeline */}
          <div className="rounded-xl bg-slate-800 border border-slate-700/50 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-700/50">
              <p className="text-sm font-semibold text-white">Warranty Expiration Timeline</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700/50 hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400">Window</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400 text-right">Sections Expiring</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400 text-right">% of Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { window: "Already expired", count: expired },
                  { window: "Next 12 months", count: expiring12mo },
                  { window: "12–24 months", count: expiring12to24 },
                  { window: "24–36 months", count: expiring24to36 },
                  { window: "Beyond 36 months", count: beyond36 },
                ].map(r => (
                  <TableRow key={r.window} className="border-slate-700/50 hover:bg-slate-700/50">
                    <TableCell className="text-sm text-slate-200">{r.window}</TableCell>
                    <TableCell className="text-sm text-slate-300 text-right">{r.count}</TableCell>
                    <TableCell className="text-sm text-slate-300 text-right">{wPct(r.count)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
