import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { Plus, GripVertical } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

// ---------- Types ----------
type StatusDef = {
  key: string;
  label: string;
  color: string;
  owner_role: string;
  order: number;
};

type JobType = {
  id: string;
  name: string;
  description: string | null;
  statuses: StatusDef[];
  is_active: boolean;
};

type CMJob = {
  id: string;
  job_type_id: string;
  client_id: string;
  title: string;
  description: string | null;
  status: string;
  assigned_to: string | null;
  priority: string;
  scheduled_date: string | null;
  due_date: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  region_id: string | null;
  building_id: string | null;
  property_manager_name: string | null;
  property_manager_phone: string | null;
  property_manager_email: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  clients?: { name: string } | null;
  assigned_user?: { full_name: string } | null;
};

type Client = { id: string; name: string };
type Region = { id: string; name: string; client_id: string };
type UserOption = { id: string; full_name: string };

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

// ---------- Draggable Card ----------
function DraggableJobCard({ job, canDrag }: { job: CMJob; canDrag: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: job.id,
    disabled: !canDrag,
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border bg-card p-3 space-y-1.5 shadow-sm transition-opacity ${isDragging ? "opacity-50" : ""} ${canDrag ? "cursor-grab active:cursor-grabbing" : ""}`}
      {...(canDrag ? { ...listeners, ...attributes } : {})}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="font-medium text-sm leading-tight">{job.title}</p>
        {canDrag && <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </div>
      {(job.address || job.city) && (
        <p className="text-xs text-muted-foreground truncate">
          {[job.address, job.city, job.state].filter(Boolean).join(", ")}
        </p>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        {job.clients?.name && (
          <span className="text-xs text-muted-foreground">{job.clients.name}</span>
        )}
        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[job.priority] ?? ""}`}>
          {job.priority}
        </Badge>
      </div>
      {job.assigned_user?.full_name && (
        <p className="text-xs text-muted-foreground">→ {job.assigned_user.full_name}</p>
      )}
      {job.scheduled_date && (
        <p className="text-xs text-muted-foreground">
          📅 {format(new Date(job.scheduled_date), "MMM d, yyyy")}
        </p>
      )}
    </div>
  );
}

// ---------- Droppable Column ----------
function KanbanColumn({
  statusDef,
  jobs,
  canDrag,
}: {
  statusDef: StatusDef;
  jobs: CMJob[];
  canDrag: (job: CMJob) => boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: statusDef.key });

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-[260px] rounded-lg border bg-muted/30 flex flex-col max-h-[calc(100vh-280px)] ${isOver ? "ring-2 ring-primary/40" : ""}`}
    >
      <div className="flex items-center gap-2 p-3 border-b">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: statusDef.color }} />
        <span className="text-sm font-medium truncate">{statusDef.label}</span>
        <Badge variant="secondary" className="ml-auto text-xs">{jobs.length}</Badge>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {jobs.map((j) => (
          <DraggableJobCard key={j.id} job={j} canDrag={canDrag(j)} />
        ))}
        {jobs.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No jobs</p>
        )}
      </div>
    </div>
  );
}

// ---------- Main Board ----------
export default function CMJobsBoard() {
  const { user, role } = useAuth();
  const canWrite = role === "admin" || role === "office_manager";

  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [jobs, setJobs] = useState<CMJob[]>([]);
  const [loading, setLoading] = useState(true);

  const [clients, setClients] = useState<Client[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  // Filters
  const [filterClient, setFilterClient] = useState("all");
  const [filterAssigned, setFilterAssigned] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    client_id: "",
    region_id: "",
    building_id: "",
    priority: "normal",
    assigned_to: "",
    scheduled_date: "",
    due_date: "",
    address: "",
    city: "",
    state: "",
    property_manager_name: "",
    property_manager_phone: "",
    property_manager_email: "",
    notes: "",
  });

  // Drag
  const [activeJob, setActiveJob] = useState<CMJob | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const selectedType = useMemo(
    () => jobTypes.find((t) => t.id === selectedTypeId),
    [jobTypes, selectedTypeId]
  );

  const sortedStatuses = useMemo(
    () => (selectedType?.statuses ?? []).slice().sort((a, b) => a.order - b.order),
    [selectedType]
  );

  const filteredJobs = useMemo(() => {
    let list = jobs;
    if (filterClient !== "all") list = list.filter((j) => j.client_id === filterClient);
    if (filterAssigned !== "all") list = list.filter((j) => j.assigned_to === filterAssigned);
    if (filterPriority !== "all") list = list.filter((j) => j.priority === filterPriority);
    return list;
  }, [jobs, filterClient, filterAssigned, filterPriority]);

  const dialogRegions = useMemo(
    () => (form.client_id ? regions.filter((r) => r.client_id === form.client_id) : []),
    [regions, form.client_id]
  );

  // ---------- Data Fetching ----------
  useEffect(() => {
    fetchJobTypes();
    fetchClients();
    fetchUsers();
    fetchRegions();
  }, []);

  useEffect(() => {
    if (selectedTypeId) fetchJobs();
  }, [selectedTypeId]);

  async function fetchJobTypes() {
    const { data } = await supabase
      .from("cm_job_types" as any)
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (data && (data as any[]).length > 0) {
      const typed = data as unknown as JobType[];
      setJobTypes(typed);
      setSelectedTypeId(typed[0].id);
    }
    setLoading(false);
  }

  async function fetchJobs() {
    setLoading(true);
    const { data, error } = await supabase
      .from("cm_jobs" as any)
      .select("*, clients(name), assigned_user:user_profiles!cm_jobs_assigned_to_fkey(full_name)")
      .eq("job_type_id", selectedTypeId)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load CM jobs");
    } else {
      setJobs((data as unknown as CMJob[]) ?? []);
    }
    setLoading(false);
  }

  async function fetchClients() {
    const { data } = await supabase.from("clients").select("id, name").eq("is_active", true).order("name");
    if (data) setClients(data);
  }

  async function fetchRegions() {
    const { data } = await supabase.from("regions").select("id, name, client_id").order("name");
    if (data) setRegions(data);
  }

  async function fetchUsers() {
    const { data } = await supabase.from("user_profiles").select("id, full_name").eq("is_active", true).order("full_name");
    if (data) setUsers(data as UserOption[]);
  }

  // ---------- Drag Handlers ----------
  function canDrag(job: CMJob): boolean {
    if (canWrite) return true;
    if (role === "field_ops" && job.assigned_to === user?.id) return true;
    if (role === "engineer" && job.assigned_to === user?.id) return true;
    return false;
  }

  function handleDragStart(event: DragStartEvent) {
    const job = jobs.find((j) => j.id === event.active.id);
    setActiveJob(job ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveJob(null);
    const { active, over } = event;
    if (!over || !user) return;

    const jobId = active.id as string;
    const newStatus = over.id as string;
    const job = jobs.find((j) => j.id === jobId);
    if (!job || job.status === newStatus) return;

    const oldStatus = job.status;

    // Optimistic update
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: newStatus } : j)));

    const { error } = await supabase
      .from("cm_jobs" as any)
      .update({ status: newStatus } as any)
      .eq("id", jobId);

    if (error) {
      toast.error("Failed to update status");
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: oldStatus } : j)));
      return;
    }

    // History + activity log (fire and forget)
    await Promise.all([
      supabase.from("cm_job_status_history" as any).insert({
        cm_job_id: jobId,
        from_status: oldStatus,
        to_status: newStatus,
        changed_by: user.id,
      } as any),
      supabase.from("activity_log").insert({
        action: "status_change",
        entity_type: "cm_job",
        entity_id: jobId,
        user_id: user.id,
        details: { from_status: oldStatus, to_status: newStatus },
      }),
    ]);

    const statusLabel = sortedStatuses.find((s) => s.key === newStatus)?.label ?? newStatus;
    toast.success(`Moved to ${statusLabel}`);
  }

  // ---------- Create Job ----------
  async function handleCreate() {
    if (!form.title || !form.client_id || !selectedTypeId) {
      toast.error("Title and Client are required");
      return;
    }
    setSaving(true);

    const { error } = await supabase.from("cm_jobs" as any).insert({
      job_type_id: selectedTypeId,
      title: form.title,
      client_id: form.client_id,
      region_id: form.region_id || null,
      building_id: form.building_id || null,
      priority: form.priority,
      assigned_to: form.assigned_to || null,
      scheduled_date: form.scheduled_date || null,
      due_date: form.due_date || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      property_manager_name: form.property_manager_name || null,
      property_manager_phone: form.property_manager_phone || null,
      property_manager_email: form.property_manager_email || null,
      notes: form.notes || null,
      status: "approved",
      created_by: user?.id,
    } as any);

    if (error) {
      toast.error("Failed to create job");
      setSaving(false);
      return;
    }

    // Log history + activity
    // We don't have the inserted id easily with `as any`, so refetch
    toast.success("Job created");
    setSaving(false);
    setDialogOpen(false);
    resetForm();
    fetchJobs();
  }

  function resetForm() {
    setForm({
      title: "", client_id: "", region_id: "", building_id: "", priority: "normal",
      assigned_to: "", scheduled_date: "", due_date: "", address: "", city: "", state: "",
      property_manager_name: "", property_manager_phone: "", property_manager_email: "", notes: "",
    });
  }

  // ---------- Render ----------
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Job Type" />
          </SelectTrigger>
          <SelectContent>
            {jobTypes.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="All Clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterAssigned} onValueChange={setFilterAssigned}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="All Assigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assigned</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>

        {canWrite && (
          <Button size="sm" onClick={() => setDialogOpen(true)} className="ml-auto">
            <Plus className="h-4 w-4 mr-1" /> New Job
          </Button>
        )}
      </div>

      {/* Kanban Board */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : sortedStatuses.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No job types configured.</p>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-3" style={{ minWidth: sortedStatuses.length * 276 }}>
              {sortedStatuses.map((s) => (
                <KanbanColumn
                  key={s.key}
                  statusDef={s}
                  jobs={filteredJobs.filter((j) => j.status === s.key)}
                  canDrag={canDrag}
                />
              ))}
            </div>
          </div>
          <DragOverlay>
            {activeJob ? (
              <div className="w-[260px] rounded-lg border bg-card p-3 shadow-lg opacity-90">
                <p className="font-medium text-sm">{activeJob.title}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* New Job Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } else setDialogOpen(true); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New CM Job</DialogTitle>
            <DialogDescription>Create a new job for {selectedType?.name ?? "this pipeline"}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Client *</Label>
                <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v, region_id: "", building_id: "" })}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Region</Label>
                <Select value={form.region_id} onValueChange={(v) => setForm({ ...form, region_id: v })} disabled={!form.client_id}>
                  <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                  <SelectContent>
                    {dialogRegions.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Assigned To</Label>
                <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Scheduled Date</Label>
                <Input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Due Date</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>State</Label>
                <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>PM Name</Label>
                <Input value={form.property_manager_name} onChange={(e) => setForm({ ...form, property_manager_name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>PM Phone</Label>
                <Input value={form.property_manager_phone} onChange={(e) => setForm({ ...form, property_manager_phone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>PM Email</Label>
                <Input value={form.property_manager_email} onChange={(e) => setForm({ ...form, property_manager_email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating…" : "Create Job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
