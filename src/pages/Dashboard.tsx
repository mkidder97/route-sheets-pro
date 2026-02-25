import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { ClipboardCheck, Building2, AlertTriangle, Briefcase } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Campaign {
  id: string;
  name: string;
  total_buildings: number;
  completed_buildings: number;
  clients: { name: string } | null;
}

interface ActivityEntry {
  id: string;
  action: string;
  entity_type: string;
  created_at: string | null;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function formatAction(action: string) {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [activeCampaignCount, setActiveCampaignCount] = useState(0);
  const [totalBuildings, setTotalBuildings] = useState(0);
  const [completeBuildings, setCompleteBuildings] = useState(0);
  const [priorityPending, setPriorityPending] = useState(0);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    async function load() {
      const [campCountRes, buildingsRes, campaignsRes, activityRes] = await Promise.all([
        supabase.from("inspection_campaigns").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("buildings").select("id, inspection_status, is_priority"),
        supabase.from("inspection_campaigns").select("id, name, total_buildings, completed_buildings, clients(name)").eq("status", "active").order("start_date", { ascending: true }).limit(5),
        supabase.from("activity_log").select("id, action, entity_type, created_at").order("created_at", { ascending: false }).limit(10),
      ]);

      setActiveCampaignCount(campCountRes.count ?? 0);

      if (buildingsRes.data) {
        const b = buildingsRes.data;
        setTotalBuildings(b.length);
        setCompleteBuildings(b.filter((r) => r.inspection_status === "complete").length);
        setPriorityPending(b.filter((r) => r.is_priority && r.inspection_status !== "complete").length);
      }

      if (campaignsRes.data) {
        setCampaigns(campaignsRes.data as unknown as Campaign[]);
      }

      if (activityRes.data) {
        setActivity(activityRes.data);
      }

      setLoading(false);
    }
    load();
  }, []);

  const firstName = profile?.full_name?.split(" ")[0] || "there";
  const completePct = totalBuildings > 0 ? Math.round((completeBuildings / totalBuildings) * 100) : 0;

  const stats = [
    { label: "Active Campaigns", value: activeCampaignCount, icon: ClipboardCheck },
    { label: "Buildings Complete", value: `${completeBuildings} / ${totalBuildings} (${completePct}%)`, icon: Building2 },
    { label: "Priority Pending", value: priorityPending, icon: AlertTriangle },
    { label: "Total Portfolio", value: totalBuildings, icon: Briefcase },
  ];

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading…</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          {getGreeting()}, {firstName}
        </h1>
        <p className="text-muted-foreground">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <s.icon className="h-4 w-4" />
                <span className="text-xs font-medium">{s.label}</span>
              </div>
              <div className="text-2xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Campaigns */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Active Campaigns</h2>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active campaigns.</p>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => {
                const pct = c.total_buildings > 0 ? Math.round((c.completed_buildings / c.total_buildings) * 100) : 0;
                return (
                  <Card
                    key={c.id}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => navigate(`/inspections/campaigns/${c.id}`)}
                  >
                    <CardContent className="p-4 space-y-2">
                      <div>
                        <div className="font-medium">{c.name}</div>
                        {c.clients?.name && (
                          <div className="text-xs text-muted-foreground">{c.clients.name}</div>
                        )}
                      </div>
                      <Progress value={pct} className="h-2" />
                      <div className="text-xs text-muted-foreground">
                        {c.completed_buildings} / {c.total_buildings} buildings
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          ) : (
            <div className="space-y-2">
              {activity.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-2 py-2 border-b border-border last:border-0">
                  <div>
                    <span className="text-sm font-medium">{formatAction(a.action)}</span>
                    <span className="text-xs text-muted-foreground ml-2">{a.entity_type}</span>
                  </div>
                  {a.created_at && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
