import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  startOfWeek,
  endOfWeek,
  formatDistanceToNow,
  format,
  subDays,
} from "date-fns";
import {
  Activity,
  Building2,
  ClipboardList,
  AlertTriangle,
  TrendingUp,
  Wrench,
  CheckCircle2,
  UserCheck,
} from "lucide-react";

const STALE = 30_000;
const ACCENT = "#1B4F72";
const ENGINEERING_STATUSES = ["engineering_review", "scope_complete"];

// ─── Shared: Summary Card Component ─────────────────────────────────────────

interface CardDef {
  icon: React.ElementType;
  label: string;
  value: number;
  sub: string;
  onClick?: () => void;
}

function SummaryCardGrid({ cards, cols = 4 }: { cards: CardDef[]; cols?: number }) {
  const colClass =
    cols === 3
      ? "grid-cols-1 sm:grid-cols-3"
      : cols === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4";

  return (
    <div className={`grid ${colClass} gap-4`}>
      {cards.map((c) => (
        <Card
          key={c.label}
          className="border-l-4 cursor-pointer hover:shadow-md transition-shadow"
          style={{ borderLeftColor: ACCENT }}
          onClick={c.onClick}
        >
          <CardContent className="p-4 flex items-start gap-3">
            <c.icon className="h-5 w-5 mt-1 shrink-0" style={{ color: ACCENT }} />
            <div>
              <p className="text-3xl font-bold">{c.value}</p>
              <p className="text-sm font-medium">{c.label}</p>
              <p className="text-xs text-muted-foreground">{c.sub}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CardSkeletons({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-lg" />
      ))}
    </div>
  );
}

// ─── Shared: Status config helper ───────────────────────────────────────────

interface StatusConfig {
  key: string;
  label: string;
  color: string;
  owner_role?: string;
  order?: number;
}

function useJobTypeStatuses() {
  return useQuery({
    queryKey: ["dash-cm-job-type-statuses"],
    staleTime: STALE,
    queryFn: async () => {
      const { data } = await supabase
        .from("cm_job_types")
        .select("id, name, statuses")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (!data) return null;
      const statuses: StatusConfig[] = Array.isArray(data.statuses)
        ? (data.statuses as any[]).map((s: any) => ({
            key: s.key ?? s.label,
            label: s.label ?? s.key,
            color: s.color ?? "#94a3b8",
            owner_role: s.owner_role,
            order: s.order,
          }))
        : [];
      return { id: data.id, name: data.name, statuses };
    },
  });
}

function getStatusKeysForRole(statuses: StatusConfig[], role: string): string[] {
  return statuses.filter((s) => s.owner_role === role).map((s) => s.key);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN / OFFICE_MANAGER DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

function useSummaryCards() {
  const now = new Date();
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");

  const activeCampaigns = useQuery({
    queryKey: ["dash-active-campaigns"],
    staleTime: STALE,
    queryFn: async () => {
      const { data } = await supabase
        .from("inspection_campaigns")
        .select("id, total_buildings")
        .eq("status", "active");
      return data ?? [];
    },
  });

  const cmJobs = useQuery({
    queryKey: ["dash-cm-jobs-inflight"],
    staleTime: STALE,
    queryFn: async () => {
      const { data } = await supabase
        .from("cm_jobs")
        .select("id, priority")
        .neq("status", "complete");
      return data ?? [];
    },
  });

  const completedThisWeek = useQuery({
    queryKey: ["dash-completed-week", weekStart],
    staleTime: STALE,
    queryFn: async () => {
      const { count } = await supabase
        .from("campaign_buildings")
        .select("id", { count: "exact", head: true })
        .gte("completion_date", weekStart)
        .lte("completion_date", weekEnd);
      return count ?? 0;
    },
  });

  const needsAttention = useQuery({
    queryKey: ["dash-needs-attention"],
    staleTime: STALE,
    queryFn: async () => {
      const { data: campaigns } = await supabase
        .from("inspection_campaigns")
        .select("id")
        .eq("status", "active");
      if (!campaigns?.length) return 0;
      const ids = campaigns.map((c) => c.id);
      const { data: cb } = await supabase
        .from("campaign_buildings")
        .select("building_id")
        .in("campaign_id", ids)
        .not("inspection_status", "in", '("complete","skipped")');
      if (!cb?.length) return 0;
      const bIds = cb.map((b) => b.building_id);
      const { count } = await supabase
        .from("buildings")
        .select("id", { count: "exact", head: true })
        .in("id", bIds)
        .eq("requires_advance_notice", true);
      return count ?? 0;
    },
  });

  return { activeCampaigns, cmJobs, completedThisWeek, needsAttention };
}

function AdminSummaryCards() {
  const nav = useNavigate();
  const { activeCampaigns, cmJobs, completedThisWeek, needsAttention } =
    useSummaryCards();

  const loading =
    activeCampaigns.isLoading ||
    cmJobs.isLoading ||
    completedThisWeek.isLoading ||
    needsAttention.isLoading;

  if (loading) return <CardSkeletons count={4} />;

  const ac = activeCampaigns.data ?? [];
  const totalBuildings = ac.reduce((s, c) => s + (c.total_buildings ?? 0), 0);

  const jobs = cmJobs.data ?? [];
  const priorityMap: Record<string, number> = {};
  jobs.forEach((j) => {
    priorityMap[j.priority] = (priorityMap[j.priority] ?? 0) + 1;
  });
  const prioritySub = Object.entries(priorityMap)
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");

  return (
    <SummaryCardGrid
      cards={[
        {
          icon: ClipboardList,
          label: "Active Campaigns",
          value: ac.length,
          sub: `${totalBuildings} buildings`,
          onClick: () => nav("/ops/jobs"),
        },
        {
          icon: TrendingUp,
          label: "CM Jobs In Flight",
          value: jobs.length,
          sub: prioritySub || "none",
          onClick: () => nav("/ops/jobs"),
        },
        {
          icon: Building2,
          label: "Completed This Week",
          value: completedThisWeek.data ?? 0,
          sub: "this week",
          onClick: () => nav("/ops/jobs"),
        },
        {
          icon: AlertTriangle,
          label: "Needs Attention",
          value: needsAttention.data ?? 0,
          sub: "require advance notice",
          onClick: () => nav("/ops/jobs"),
        },
      ]}
    />
  );
}

// ─── Market Overview (admin only) ───────────────────────────────────────────

function ProgressRing({
  completed,
  total,
  size = 72,
}: {
  completed: number;
  total: number;
  size?: number;
}) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={6}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={ACCENT}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="text-xs font-bold fill-foreground"
      >
        {pct}%
      </text>
    </svg>
  );
}

function MarketOverview() {
  const nav = useNavigate();

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["dash-market-campaigns"],
    staleTime: STALE,
    queryFn: async () => {
      const { data } = await supabase
        .from("inspection_campaigns")
        .select("id, name, completed_buildings, total_buildings")
        .eq("status", "active");
      return data ?? [];
    },
  });

  const { data: inspectorMap } = useQuery({
    queryKey: ["dash-market-inspectors", campaigns?.map((c) => c.id)],
    staleTime: STALE,
    enabled: !!campaigns?.length,
    queryFn: async () => {
      const map: Record<string, string> = {};
      for (const c of campaigns!) {
        const { data } = await supabase
          .from("campaign_buildings")
          .select("inspector_id, inspectors:inspector_id(name)")
          .eq("campaign_id", c.id)
          .not("inspector_id", "is", null)
          .limit(1)
          .maybeSingle();
        if (data?.inspectors) {
          map[c.id] = (data.inspectors as any).name;
        }
      }
      return map;
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!campaigns?.length) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          No active campaigns
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {campaigns.map((c) => (
        <Card
          key={c.id}
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => nav(`/ops/jobs/campaign/${c.id}`)}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <ProgressRing
              completed={c.completed_buildings}
              total={c.total_buildings}
            />
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{c.name}</p>
              <p className="text-xs text-muted-foreground">
                {c.completed_buildings}/{c.total_buildings} buildings
              </p>
              {inspectorMap?.[c.id] && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {inspectorMap[c.id]}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── CM Pipeline (admin only) ───────────────────────────────────────────────

function CMPipeline() {
  const { data: jobTypeData, isLoading: jtLoading } = useJobTypeStatuses();

  const { data: jobs } = useQuery({
    queryKey: ["dash-cm-pipeline-jobs", jobTypeData?.id],
    staleTime: STALE,
    enabled: !!jobTypeData,
    queryFn: async () => {
      const { data } = await supabase
        .from("cm_jobs")
        .select("id, status")
        .eq("job_type_id", jobTypeData!.id);
      return data ?? [];
    },
  });

  const { data: stuckCount } = useQuery({
    queryKey: ["dash-stuck-jobs", jobTypeData?.id],
    staleTime: STALE,
    enabled: !!jobs?.length,
    queryFn: async () => {
      const sevenDaysAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");
      const jobIds = jobs!.map((j) => j.id);
      const { data } = await supabase
        .from("cm_job_status_history")
        .select("cm_job_id, created_at")
        .in("cm_job_id", jobIds)
        .order("created_at", { ascending: false });
      if (!data?.length) return 0;
      const latest: Record<string, string> = {};
      data.forEach((row) => {
        if (!latest[row.cm_job_id]) latest[row.cm_job_id] = row.created_at;
      });
      return Object.values(latest).filter((d) => d < sevenDaysAgo).length;
    },
  });

  if (jtLoading) return <Skeleton className="h-40 rounded-lg" />;
  if (!jobTypeData) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          No active CM job types configured
        </CardContent>
      </Card>
    );
  }

  const { statuses } = jobTypeData;
  const countByStatus: Record<string, number> = {};
  (jobs ?? []).forEach((j) => {
    countByStatus[j.status] = (countByStatus[j.status] ?? 0) + 1;
  });

  const chartData = [
    statuses.reduce(
      (acc, s) => {
        acc[s.key] = countByStatus[s.key] ?? 0;
        return acc;
      },
      {} as Record<string, number>,
    ),
  ];

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center gap-2">
        <CardTitle className="text-base">{jobTypeData.name} Pipeline</CardTitle>
        {(stuckCount ?? 0) > 0 && (
          <Badge variant="destructive" className="text-[10px]">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {stuckCount} stuck &gt;7d
          </Badge>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {statuses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No statuses configured</p>
        ) : (
          <ResponsiveContainer width="100%" height={60}>
            <BarChart data={chartData} layout="vertical" barCategoryGap={0}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey={() => ""} hide />
              <Tooltip
                formatter={(value: number, name: string) => [
                  value,
                  statuses.find((s) => s.key === name)?.label ?? name,
                ]}
              />
              {statuses.map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  stackId="pipeline"
                  fill={s.color}
                  name={s.key}
                  label={{
                    position: "center",
                    fill: "#fff",
                    fontSize: 11,
                    formatter: (v: number) =>
                      v > 0 ? `${s.label} ${v}` : "",
                  }}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Recent Activity (shared, optionally filtered) ──────────────────────────

function RecentActivity({ userId }: { userId?: string }) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["dash-activity", userId ?? "all"],
    staleTime: STALE,
    refetchInterval: STALE,
    queryFn: async () => {
      let query = supabase
        .from("activity_log")
        .select("id, action, entity_type, entity_id, user_id, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (userId) {
        query = query.eq("user_id", userId);
      }
      const { data } = await query;
      return data ?? [];
    },
  });

  const logUserIds = [...new Set((logs ?? []).map((l) => l.user_id).filter(Boolean))] as string[];

  const { data: profiles } = useQuery({
    queryKey: ["dash-activity-profiles", logUserIds],
    staleTime: STALE,
    enabled: logUserIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, full_name")
        .in("id", logUserIds);
      const map: Record<string, string> = {};
      (data ?? []).forEach((p) => (map[p.id] = p.full_name));
      return map;
    },
  });

  if (isLoading) return <Skeleton className="h-60 rounded-lg" />;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" /> Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {!logs?.length ? (
          <p className="text-sm text-muted-foreground">No recent activity</p>
        ) : (
          <ScrollArea className="max-h-80">
            <ul className="space-y-2">
              {logs.map((l) => (
                <li key={l.id} className="text-sm flex justify-between gap-2">
                  <span>
                    <span className="font-medium">
                      {(profiles ?? {})[l.user_id ?? ""] ?? "System"}
                    </span>{" "}
                    {l.action} {l.entity_type}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {l.created_at
                      ? formatDistanceToNow(new Date(l.created_at), {
                          addSuffix: true,
                        })
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FIELD_OPS DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

function FieldOpsDashboard() {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const userId = user?.id;
  const inspectorId = profile?.inspector_id;
  const now = new Date();
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");

  const { data: jobTypeData } = useJobTypeStatuses();
  const fieldOpsStatuses = jobTypeData
    ? getStatusKeysForRole(jobTypeData.statuses, "field_ops")
    : [];

  // Card 1: My Active Jobs
  const { data: myActiveJobs, isLoading: l1 } = useQuery({
    queryKey: ["dash-fo-active", userId],
    staleTime: STALE,
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("cm_jobs")
        .select("id")
        .eq("assigned_to", userId!)
        .neq("status", "complete");
      return data ?? [];
    },
  });

  // Card 2: Awaiting My Action (status owner_role = field_ops, assigned to me or unassigned)
  const { data: awaitingAction, isLoading: l2 } = useQuery({
    queryKey: ["dash-fo-awaiting", userId, fieldOpsStatuses],
    staleTime: STALE,
    enabled: !!userId && fieldOpsStatuses.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("cm_jobs")
        .select("id")
        .in("status", fieldOpsStatuses)
        .or(`assigned_to.eq.${userId},assigned_to.is.null`);
      return data ?? [];
    },
  });

  // Card 3: Completed This Week (by inspector_id)
  const { data: completedWeek, isLoading: l3 } = useQuery({
    queryKey: ["dash-fo-completed-week", inspectorId, weekStart],
    staleTime: STALE,
    enabled: !!inspectorId,
    queryFn: async () => {
      const { count } = await supabase
        .from("campaign_buildings")
        .select("id", { count: "exact", head: true })
        .eq("inspector_id", inspectorId!)
        .gte("completion_date", weekStart)
        .lte("completion_date", weekEnd);
      return count ?? 0;
    },
  });

  // My Jobs list grouped by status
  const { data: myJobs, isLoading: l4 } = useQuery({
    queryKey: ["dash-fo-myjobs", userId],
    staleTime: STALE,
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("cm_jobs")
        .select("id, title, address, city, status")
        .eq("assigned_to", userId!)
        .neq("status", "complete")
        .order("status");
      return data ?? [];
    },
  });

  const loading = l1 || l2 || l3 || l4;

  // Group jobs by status
  const jobsByStatus: Record<string, typeof myJobs> = {};
  (myJobs ?? []).forEach((j) => {
    if (!jobsByStatus[j.status]) jobsByStatus[j.status] = [];
    jobsByStatus[j.status]!.push(j);
  });

  const statusLabel = (key: string) =>
    jobTypeData?.statuses.find((s) => s.key === key)?.label ?? key;
  const statusColor = (key: string) =>
    jobTypeData?.statuses.find((s) => s.key === key)?.color ?? "#94a3b8";

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold">My Dashboard</h1>

      {loading ? (
        <CardSkeletons count={3} />
      ) : (
        <SummaryCardGrid
          cols={3}
          cards={[
            {
              icon: Wrench,
              label: "My Active Jobs",
              value: myActiveJobs?.length ?? 0,
              sub: "assigned to you",
              onClick: () => nav("/ops/jobs"),
            },
            {
              icon: UserCheck,
              label: "Awaiting My Action",
              value: awaitingAction?.length ?? 0,
              sub: "your turn",
              onClick: () => nav("/ops/jobs"),
            },
            {
              icon: Building2,
              label: "Completed This Week",
              value: completedWeek ?? 0,
              sub: "inspections this week",
              onClick: () => nav("/ops/jobs"),
            },
          ]}
        />
      )}

      {/* My Jobs list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">My Jobs</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {l4 ? (
            <Skeleton className="h-40 rounded-lg" />
          ) : !myJobs?.length ? (
            <p className="text-sm text-muted-foreground">No active jobs assigned to you</p>
          ) : (
            <ScrollArea className="max-h-96">
              <div className="space-y-4">
                {Object.entries(jobsByStatus).map(([status, sjobs]) => (
                  <div key={status}>
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: statusColor(status) }}
                      />
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {statusLabel(status)} ({sjobs?.length ?? 0})
                      </span>
                    </div>
                    <ul className="space-y-1 pl-5">
                      {sjobs?.map((j) => (
                        <li
                          key={j.id}
                          className="text-sm cursor-pointer hover:text-primary transition-colors"
                          onClick={() => nav(`/ops/jobs`)}
                        >
                          <span className="font-medium">{j.title}</span>
                          {j.address && (
                            <span className="text-muted-foreground ml-1">
                              — {j.address}{j.city ? `, ${j.city}` : ""}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <RecentActivity userId={userId} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENGINEER DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

function EngineerDashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const userId = user?.id;

  const { data: jobTypeData } = useJobTypeStatuses();
  const engineerStatuses = jobTypeData
    ? getStatusKeysForRole(jobTypeData.statuses, "engineer")
    : [];

  // Card 1: Awaiting Review
  const { data: awaitingReview, isLoading: l1 } = useQuery({
    queryKey: ["dash-eng-awaiting", engineerStatuses],
    staleTime: STALE,
    enabled: engineerStatuses.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("cm_jobs")
        .select("id")
        .in("status", engineerStatuses);
      return data ?? [];
    },
  });

  // Card 2: Completed Reviews (user moved jobs past engineering stages)
  const { data: completedReviews, isLoading: l2 } = useQuery({
    queryKey: ["dash-eng-completed", userId],
    staleTime: STALE,
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("cm_job_status_history")
        .select("id")
        .eq("changed_by", userId!)
        .in("from_status", ENGINEERING_STATUSES);
      return data ?? [];
    },
  });

  // Jobs in engineering stages
  const { data: engJobs, isLoading: l3 } = useQuery({
    queryKey: ["dash-eng-jobs", engineerStatuses],
    staleTime: STALE,
    enabled: engineerStatuses.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("cm_jobs")
        .select("id, title, address, city, status, due_date")
        .in("status", engineerStatuses)
        .order("due_date", { ascending: true, nullsFirst: false });
      return data ?? [];
    },
  });

  const loading = l1 || l2 || l3;

  const statusLabel = (key: string) =>
    jobTypeData?.statuses.find((s) => s.key === key)?.label ?? key;
  const statusColor = (key: string) =>
    jobTypeData?.statuses.find((s) => s.key === key)?.color ?? "#94a3b8";

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold">Engineering Dashboard</h1>

      {loading ? (
        <CardSkeletons count={2} />
      ) : (
        <SummaryCardGrid
          cols={2}
          cards={[
            {
              icon: ClipboardList,
              label: "Awaiting Review",
              value: awaitingReview?.length ?? 0,
              sub: "in engineering stages",
              onClick: () => nav("/ops/jobs"),
            },
            {
              icon: CheckCircle2,
              label: "Completed Reviews",
              value: completedReviews?.length ?? 0,
              sub: "reviews you've completed",
              onClick: () => nav("/ops/jobs"),
            },
          ]}
        />
      )}

      {/* Engineering jobs list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Engineering Queue</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {l3 ? (
            <Skeleton className="h-40 rounded-lg" />
          ) : !engJobs?.length ? (
            <p className="text-sm text-muted-foreground">No jobs in engineering stages</p>
          ) : (
            <ScrollArea className="max-h-96">
              <ul className="space-y-2">
                {engJobs.map((j) => (
                  <li
                    key={j.id}
                    className="text-sm flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
                    onClick={() => nav("/ops/jobs")}
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: statusColor(j.status) }}
                    />
                    <span className="font-medium">{j.title}</span>
                    {j.address && (
                      <span className="text-muted-foreground">
                        — {j.address}{j.city ? `, ${j.city}` : ""}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                      {statusLabel(j.status)}
                      {j.due_date && ` · Due ${format(new Date(j.due_date), "MMM d")}`}
                    </span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <RecentActivity userId={userId} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD — ROLE SWITCH
// ═══════════════════════════════════════════════════════════════════════════════

export default function OpsDashboard() {
  const { role, user } = useAuth();

  if (role === "field_ops") {
    return <FieldOpsDashboard />;
  }

  if (role === "engineer") {
    return <EngineerDashboard />;
  }

  // admin / office_manager — full view
  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold">Dashboard</h1>
      <AdminSummaryCards />
      <div>
        <h2 className="text-base font-semibold mb-3">Market Overview</h2>
        <MarketOverview />
      </div>
      <CMPipeline />
      <RecentActivity />
    </div>
  );
}
