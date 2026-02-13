import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
  inspection_type: string;
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

const INSPECTION_TYPE_OPTIONS = [
  { value: "annual", label: "Annual" },
  { value: "due_diligence", label: "Due Diligence" },
  { value: "survey", label: "Survey" },
  { value: "storm", label: "Storm" },
] as const;

const TYPE_BADGE_COLORS: Record<string, string> = {
  annual: "border-blue-500 text-blue-700 dark:text-blue-300",
  due_diligence: "border-purple-500 text-purple-700 dark:text-purple-300",
  survey: "border-teal-500 text-teal-700 dark:text-teal-300",
  storm: "border-red-500 text-red-700 dark:text-red-300",
};

export default function OpsJobBoard() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const canWrite = role === "admin" || role === "office_manager";

  const [clients, setClients] = useState<Client[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterRegion, setFilterRegion] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [form, setForm] = useState({
    inspection_type: "annual",
    name: "",
    client_id: "",
    region_id: "",
    start_date: "",
    end_date: "",
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

  // Auto-fill campaign name when client and region are selected
  useEffect(() => {
    if (nameManuallyEdited) return;
    if (form.client_id && form.region_id) {
      const client = clients.find((c) => c.id === form.client_id);
      const region = regions.find((r) => r.id === form.region_id);
      if (client && region) {
        setForm((prev) => ({ ...prev, name: `${client.name} — ${region.name}` }));
      }
    }
  }, [form.client_id, form.region_id, clients, regions, nameManuallyEdited]);

  useEffect(() => {
    fetchClients();
    fetchRegions();
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [filterClient, filterRegion, filterStatus, filterType]);

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
    if (filterType && filterType !== "all") query = query.eq("inspection_type", filterType);

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

    // Insert campaign
    const { data: inserted, error } = await supabase
      .from("inspection_campaigns")
      .insert({
        name: form.name,
        client_id: form.client_id,
        region_id: form.region_id,
        start_date: form.start_date,
        end_date: form.end_date,
        status: "active",
        inspection_type: form.inspection_type,
        notes: form.notes || null,
      } as any)
      .select("id")
      .single();

    if (error || !inserted) {
      setSaving(false);
      toast.error("Failed to create campaign");
      return;
    }

    // Fetch buildings for this client/region to snapshot into campaign_buildings
    const { data: buildingsData, error: buildingsError } = await supabase
      .from("buildings")
      .select("id, is_priority")
      .eq("client_id", form.client_id)
      .eq("region_id", form.region_id);

    if (buildingsError || !buildingsData) {
      toast.warning("Campaign created but failed to load buildings for snapshot.");
      setSaving(false);
      setDialogOpen(false);
      setForm({ inspection_type: "annual", name: "", client_id: "", region_id: "", start_date: "", end_date: "", notes: "" });
      setNameManuallyEdited(false);
      fetchCampaigns();
      return;
    }

    // Build campaign_buildings rows
    const rows = buildingsData.map((b) => ({
      campaign_id: inserted.id,
      building_id: b.id,
      is_priority: b.is_priority ?? false,
    }));

    // Chunked bulk insert (batches of 500)
    const BATCH_SIZE = 500;
    let insertFailed = false;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error: batchError } = await supabase
        .from("campaign_buildings" as any)
        .insert(batch as any);
      if (batchError) {
        console.error("Batch insert error:", batchError);
        insertFailed = true;
        break;
      }
    }

    if (insertFailed) {
      toast.warning("Campaign created but some buildings may not have been added. You can re-sync later.");
    }

    // Update campaign with total count
    await supabase
      .from("inspection_campaigns")
      .update({
        total_buildings: rows.length,
        completed_buildings: 0,
      })
      .eq("id", inserted.id);

    setSaving(false);
    toast.success("Campaign created");
    setDialogOpen(false);
    setForm({ inspection_type: "annual", name: "", client_id: "", region_id: "", start_date: "", end_date: "", notes: "" });
    setNameManuallyEdited(false);
    fetchCampaigns();
  }

  function resetDialog() {
    setDialogOpen(false);
    setForm({ inspection_type: "annual", name: "", client_id: "", region_id: "", start_date: "", end_date: "", notes: "" });
    setNameManuallyEdited(false);
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

      <Tabs defaultValue="inspections">
        <TabsList>
          <TabsTrigger value="inspections">Inspections</TabsTrigger>
          <TabsTrigger value="cm">CM Jobs</TabsTrigger>
        </TabsList>

        <TabsContent value="inspections" className="space-y-4">
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

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {INSPECTION_TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                    onClick={() => navigate(`/ops/jobs/campaign/${c.id}`)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base leading-tight">
                          {c.name}
                        </CardTitle>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="secondary" className={STATUS_COLORS[c.status] ?? ""}>
                            {STATUS_OPTIONS.find((s) => s.value === c.status)?.label ?? c.status}
                          </Badge>
                          <Badge variant="outline" className={TYPE_BADGE_COLORS[c.inspection_type] ?? ""}>
                            {INSPECTION_TYPE_OPTIONS.find((t) => t.value === c.inspection_type)?.label ?? c.inspection_type}
                          </Badge>
                        </div>
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
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetDialog(); else setDialogOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Campaign</DialogTitle>
            <DialogDescription>Create a new inspection campaign.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Inspection Type *</Label>
              <Select
                value={form.inspection_type}
                onValueChange={(v) => setForm((prev) => ({ ...prev, inspection_type: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {INSPECTION_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Client *</Label>
                <Select
                  value={form.client_id}
                  onValueChange={(v) => {
                    setForm((prev) => ({ ...prev, client_id: v, region_id: "" }));
                    setNameManuallyEdited(false);
                  }}
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
                  onValueChange={(v) => {
                    setForm((prev) => ({ ...prev, region_id: v }));
                    setNameManuallyEdited(false);
                  }}
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
            <div className="space-y-1">
              <Label>Campaign Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, name: e.target.value }));
                  setNameManuallyEdited(true);
                }}
              />
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
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetDialog}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating…" : "Create Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
