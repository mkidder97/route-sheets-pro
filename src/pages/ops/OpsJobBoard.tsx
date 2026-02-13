import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
} from "@/components/ui/dialog";

type Campaign = {
  id: string;
  client_id: string;
  region_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  total_buildings: number;
  completed_buildings: number;
  notes: string | null;
  clients?: { name: string } | null;
  regions?: { name: string } | null;
};

type Client = { id: string; name: string };
type Region = { id: string; name: string; client_id: string };

const STATUS_OPTIONS = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "complete", label: "Complete" },
  { value: "on_hold", label: "On Hold" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-muted text-muted-foreground",
  active: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  complete: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  on_hold: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

export default function OpsJobBoard() {
  const { role } = useAuth();
  const canWrite = role === "admin" || role === "office_manager";

  const [clients, setClients] = useState<Client[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterRegion, setFilterRegion] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    client_id: "",
    region_id: "",
    start_date: "",
    end_date: "",
    status: "active",
    notes: "",
  });

  const filteredRegions = useMemo(
    () =>
      filterClient && filterClient !== "all"
        ? regions.filter((r) => r.client_id === filterClient)
        : regions,
    [regions, filterClient]
  );

  const dialogRegions = useMemo(
    () =>
      form.client_id
        ? regions.filter((r) => r.client_id === form.client_id)
        : [],
    [regions, form.client_id]
  );

  useEffect(() => {
    fetchClients();
    fetchRegions();
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [filterClient, filterRegion, filterStatus]);

  // Reset region filter when client changes
  useEffect(() => {
    setFilterRegion("all");
  }, [filterClient]);

  async function fetchClients() {
    const { data } = await supabase
      .from("clients")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    if (data) setClients(data);
  }

  async function fetchRegions() {
    const { data } = await supabase
      .from("regions")
      .select("id, name, client_id")
      .order("name");
    if (data) setRegions(data);
  }

  async function fetchCampaigns() {
    setLoading(true);
    let query = supabase
      .from("inspection_campaigns")
      .select("*, clients(name), regions(name)")
      .order("name");

    if (filterClient && filterClient !== "all") query = query.eq("client_id", filterClient);
    if (filterRegion && filterRegion !== "all") query = query.eq("region_id", filterRegion);
    if (filterStatus && filterStatus !== "all") query = query.eq("status", filterStatus);

    const { data, error } = await query;
    if (error) {
      toast.error("Failed to load campaigns");
    } else {
      setCampaigns((data as Campaign[]) ?? []);
    }
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.name || !form.client_id || !form.region_id || !form.start_date || !form.end_date) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("inspection_campaigns").insert({
      name: form.name,
      client_id: form.client_id,
      region_id: form.region_id,
      start_date: form.start_date,
      end_date: form.end_date,
      status: form.status,
      notes: form.notes || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Failed to create campaign");
    } else {
      toast.success("Campaign created");
      setDialogOpen(false);
      setForm({ name: "", client_id: "", region_id: "", start_date: "", end_date: "", status: "active", notes: "" });
      fetchCampaigns();
    }
  }

  function progressPercent(completed: number, total: number) {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold">Job Board</h1>
        {canWrite && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Campaign
          </Button>
        )}
      </div>

      <Tabs defaultValue="annuals">
        <TabsList>
          <TabsTrigger value="annuals">Annuals</TabsTrigger>
          <TabsTrigger value="cm">CM Jobs</TabsTrigger>
        </TabsList>

        <TabsContent value="annuals" className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-wrap gap-3">
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterRegion} onValueChange={setFilterRegion}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Regions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {filteredRegions.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Campaign grid */}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No campaigns found.</p>
              <p className="text-sm mt-1">Create your first campaign to get started.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((c) => {
                const pct = progressPercent(c.completed_buildings, c.total_buildings);
                return (
                  <Card
                    key={c.id}
                    className="cursor-pointer transition-shadow hover:shadow-md"
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base leading-tight">
                          {c.name}
                        </CardTitle>
                        <Badge variant="secondary" className={STATUS_COLORS[c.status] ?? ""}>
                          {STATUS_OPTIONS.find((s) => s.value === c.status)?.label ?? c.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {c.clients?.name} — {c.regions?.name}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(c.start_date), "MMM d, yyyy")} –{" "}
                        {format(new Date(c.end_date), "MMM d, yyyy")}
                      </p>
                      <Progress value={pct} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {c.completed_buildings} / {c.total_buildings} buildings ({pct}%)
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cm">
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">Coming Soon — Phase 2</p>
            <p className="text-sm mt-1">CM Jobs management will be available in a future update.</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* New Campaign Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Campaign</DialogTitle>
            <DialogDescription>Create a new annual inspection campaign.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Campaign Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Client *</Label>
                <Select
                  value={form.client_id}
                  onValueChange={(v) => setForm({ ...form, client_id: v, region_id: "" })}
                >
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Region *</Label>
                <Select
                  value={form.region_id}
                  onValueChange={(v) => setForm({ ...form, region_id: v })}
                  disabled={!form.client_id}
                >
                  <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                  <SelectContent>
                    {dialogRegions.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start Date *</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>End Date *</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating…" : "Create Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
