import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { createNotification } from "@/lib/notifications";
import { format, formatDistanceToNow } from "date-fns";
import { Plus, GripVertical, X, Send, Check } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

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
type BuildingOption = {
  id: string;
  property_name: string;
  address: string;
  city: string;
  state: string;
  property_manager_name: string | null;
  property_manager_phone: string | null;
  property_manager_email: string | null;
};

type HistoryEntry = {
  id: string;
  from_status: string | null;
  to_status: string;
  created_at: string;
  changed_by_user?: { full_name: string } | null;
};

type Comment = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  commenter?: { full_name: string } | null;
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

// ---------- Draggable Card ----------
function DraggableJobCard({
  job,
  canDrag,
  isYourTurn,
  onClick,
}: {
  job: CMJob;
  canDrag: boolean;
  isYourTurn: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: job.id,
    disabled: !canDrag,
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border bg-card p-3 space-y-1.5 shadow-sm transition-opacity ${isDragging ? "opacity-50" : ""} ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${isYourTurn ? "border-l-2 border-l-primary" : ""}`}
      {...(canDrag ? { ...listeners, ...attributes } : {})}
      onClick={(e) => {
        if (!isDragging) {
          e.stopPropagation();
          onClick();
        }
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="font-medium text-sm leading-tight">{job.title}</p>
        <div className="flex items-center gap-1 shrink-0">
          {isYourTurn && (
            <Badge variant="default" className="text-[9px] px-1 py-0">Your Turn</Badge>
          )}
          {canDrag && <GripVertical className="h-4 w-4 text-muted-foreground" />}
        </div>
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
  userRole,
  onCardClick,
}: {
  statusDef: StatusDef;
  jobs: CMJob[];
  canDrag: (job: CMJob) => boolean;
  userRole: string | null;
  onCardClick: (jobId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: statusDef.key });
  const isYourTurnColumn = !!userRole && statusDef.owner_role === userRole;

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
          <DraggableJobCard key={j.id} job={j} canDrag={canDrag(j)} isYourTurn={isYourTurnColumn} onClick={() => onCardClick(j.id)} />
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
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);

  // Filters
  const [filterClient, setFilterClient] = useState("all");
  const [filterAssigned, setFilterAssigned] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    job_type_id: "",
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
    description: "",
    property_manager_name: "",
    property_manager_phone: "",
    property_manager_email: "",
    notes: "",
  });

  // Detail panel
  const [detailJobId, setDetailJobId] = useState<string | null>(null);
  const [detailJob, setDetailJob] = useState<CMJob | null>(null);
  const [statusHistory, setStatusHistory] = useState<HistoryEntry[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);

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

  const dialogBuildings = useMemo(() => {
    let list = buildings;
    if (form.client_id) list = list.filter((b: any) => true); // buildings already filtered by fetch
    return list;
  }, [buildings]);

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

  // Fetch buildings when dialog client/region changes
  useEffect(() => {
    if (form.client_id && dialogOpen) {
      fetchBuildings(form.client_id, form.region_id || undefined);
    } else {
      setBuildings([]);
    }
  }, [form.client_id, form.region_id, dialogOpen]);

  // Fetch detail data when panel opens
  useEffect(() => {
    if (detailJobId) {
      fetchDetailJob(detailJobId);
      fetchStatusHistory(detailJobId);
      fetchComments(detailJobId);
    }
  }, [detailJobId]);

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

  async function fetchBuildings(clientId: string, regionId?: string) {
    let query = supabase
      .from("buildings")
      .select("id, property_name, address, city, state, property_manager_name, property_manager_phone, property_manager_email")
      .eq("client_id", clientId)
      .order("property_name");
    if (regionId) query = query.eq("region_id", regionId);
    const { data } = await query;
    if (data) setBuildings(data as BuildingOption[]);
  }

  async function fetchDetailJob(jobId: string) {
    setDetailLoading(true);
    const { data } = await supabase
      .from("cm_jobs" as any)
      .select("*, clients(name), assigned_user:user_profiles!cm_jobs_assigned_to_fkey(full_name)")
      .eq("id", jobId)
      .single();
    if (data) {
      setDetailJob(data as unknown as CMJob);
      setEditTitleValue((data as any).title);
    }
    setDetailLoading(false);
  }

  async function fetchStatusHistory(jobId: string) {
    const { data } = await supabase
      .from("cm_job_status_history" as any)
      .select("*, changed_by_user:user_profiles!cm_job_status_history_changed_by_fkey(full_name)")
      .eq("cm_job_id", jobId)
      .order("created_at", { ascending: false });
    if (data) setStatusHistory(data as unknown as HistoryEntry[]);
  }

  async function fetchComments(jobId: string) {
    const { data } = await supabase
      .from("comments")
      .select("*, commenter:user_profiles!comments_user_id_fkey(full_name)")
      .eq("entity_type", "cm_job")
      .eq("entity_id", jobId)
      .order("created_at", { ascending: false });
    if (data) setComments(data as unknown as Comment[]);
  }

  // ---------- Drag Handlers (PRESERVED from Phase 2.1) ----------
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

    await changeJobStatus(jobId, job.status, newStatus);
  }

  // ---------- Shared Status Change Logic (with handoff notifications) ----------
  async function changeJobStatus(jobId: string, oldStatus: string, newStatus: string) {
    if (!user) return;

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

    // History + activity log
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

    // --- Handoff & status change notifications (fire-and-forget) ---
    const job = jobs.find((j) => j.id === jobId);
    const oldStatusDef = sortedStatuses.find((s) => s.key === oldStatus);
    const newStatusDef = sortedStatuses.find((s) => s.key === newStatus);
    const newLabel = newStatusDef?.label ?? newStatus;
    const jobTitle = job?.title ?? "Job";
    const jobAddress = job?.address ?? "";

    const notified = new Set<string>();
    notified.add(user.id); // never notify the person who made the change
    const notificationPromises: Promise<any>[] = [];

    // Handoff: owner_role changed → notify all users with the new role
    if (oldStatusDef && newStatusDef && oldStatusDef.owner_role !== newStatusDef.owner_role) {
      const { data: roleUsers } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", newStatusDef.owner_role as any);

      if (roleUsers) {
        for (const ru of roleUsers) {
          if (!notified.has(ru.user_id)) {
            notified.add(ru.user_id);
            notificationPromises.push(
              createNotification(
                ru.user_id,
                `Job Ready: ${newLabel}`,
                `${jobTitle} at ${jobAddress || "N/A"} needs your attention`,
                "handoff",
                "cm_job",
                jobId
              )
            );
          }
        }
      }
    }

    // Always notify creator & assignee (if not already notified)
    if (job?.created_by && !notified.has(job.created_by)) {
      notified.add(job.created_by);
      notificationPromises.push(
        createNotification(
          job.created_by,
          `Status Update: ${jobTitle}`,
          `Moved to ${newLabel}`,
          "status_change",
          "cm_job",
          jobId
        )
      );
    }
    if (job?.assigned_to && !notified.has(job.assigned_to)) {
      notified.add(job.assigned_to);
      notificationPromises.push(
        createNotification(
          job.assigned_to,
          `Status Update: ${jobTitle}`,
          `Moved to ${newLabel}`,
          "status_change",
          "cm_job",
          jobId
        )
      );
    }

    // Fire all notifications without blocking UI
    if (notificationPromises.length > 0) {
      Promise.all(notificationPromises).catch(console.error);
    }

    toast.success(`Moved to ${newLabel}`);

    // Refresh detail if open
    if (detailJobId === jobId) {
      fetchDetailJob(jobId);
      fetchStatusHistory(jobId);
    }
  }

  // ---------- Create Job ----------
  async function handleCreate() {
    if (!form.title || !form.client_id) {
      toast.error("Title and Client are required");
      return;
    }
    setSaving(true);

    const jobTypeId = form.job_type_id || selectedTypeId;
    const jt = jobTypes.find((t) => t.id === jobTypeId);
    const firstStatus = jt
      ? ([...jt.statuses].sort((a, b) => a.order - b.order)[0]?.key ?? "approved")
      : "approved";

    const { data: inserted, error } = await supabase
      .from("cm_jobs" as any)
      .insert({
        job_type_id: jobTypeId,
        title: form.title,
        description: form.description || null,
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
        status: firstStatus,
        created_by: user?.id,
      } as any)
      .select("id")
      .single();

    if (error || !inserted) {
      toast.error("Failed to create job");
      setSaving(false);
      return;
    }

    const jobId = (inserted as any).id as string;

    // History + activity + notification (fire and forget)
    const historyPromise = supabase.from("cm_job_status_history" as any).insert({
      cm_job_id: jobId,
      from_status: null,
      to_status: firstStatus,
      changed_by: user?.id,
    } as any);
    const activityPromise = supabase.from("activity_log").insert({
      action: "created",
      entity_type: "cm_job",
      entity_id: jobId,
      user_id: user?.id ?? null,
      details: { title: form.title, status: firstStatus },
    });

    const promises: PromiseLike<any>[] = [historyPromise, activityPromise];

    if (form.assigned_to) {
      promises.push(
        createNotification(
          form.assigned_to,
          `New CM Job: ${form.title}`,
          `${form.address || "No address"} assigned to you`,
          "assignment",
          "cm_job",
          jobId
        )
      );
    }

    await Promise.all(promises);

    toast.success("Job created");
    setSaving(false);
    setDialogOpen(false);
    resetForm();
    fetchJobs();
  }

  function resetForm() {
    setForm({
      job_type_id: selectedTypeId,
      title: "", client_id: "", region_id: "", building_id: "", priority: "normal",
      assigned_to: "", scheduled_date: "", due_date: "", address: "", city: "", state: "",
      description: "", property_manager_name: "", property_manager_phone: "", property_manager_email: "", notes: "",
    });
  }

  function handleBuildingSelect(buildingId: string) {
    const bldg = buildings.find((b) => b.id === buildingId);
    if (bldg) {
      setForm((prev) => ({
        ...prev,
        building_id: buildingId,
        address: bldg.address || prev.address,
        city: bldg.city || prev.city,
        state: bldg.state || prev.state,
        property_manager_name: bldg.property_manager_name || prev.property_manager_name,
        property_manager_phone: bldg.property_manager_phone || prev.property_manager_phone,
        property_manager_email: bldg.property_manager_email || prev.property_manager_email,
      }));
    }
  }

  function openNewJobDialog() {
    setForm((prev) => ({ ...prev, job_type_id: selectedTypeId }));
    setDialogOpen(true);
  }

  // ---------- Detail Panel Edits ----------
  async function updateJobField(field: string, value: any) {
    if (!detailJob) return;
    const { error } = await supabase
      .from("cm_jobs" as any)
      .update({ [field]: value } as any)
      .eq("id", detailJob.id);
    if (error) {
      toast.error(`Failed to update ${field}`);
      return;
    }
    toast.success("Updated");
    setDetailJob((prev) => prev ? { ...prev, [field]: value } : prev);
    // Also update in main list
    setJobs((prev) => prev.map((j) => j.id === detailJob.id ? { ...j, [field]: value } : j));
  }

  async function handleReassign(newUserId: string) {
    if (!detailJob || !user) return;
    await updateJobField("assigned_to", newUserId || null);
    if (newUserId) {
      const assignedName = users.find((u) => u.id === newUserId)?.full_name ?? "";
      setDetailJob((prev) => prev ? { ...prev, assigned_to: newUserId, assigned_user: { full_name: assignedName } } : prev);
      setJobs((prev) => prev.map((j) => j.id === detailJob.id ? { ...j, assigned_to: newUserId, assigned_user: { full_name: assignedName } } : j));

      await Promise.all([
        supabase.from("activity_log").insert({
          action: "reassigned",
          entity_type: "cm_job",
          entity_id: detailJob.id,
          user_id: user.id,
          details: { assigned_to: newUserId },
        }),
        createNotification(
          newUserId,
          `Assigned: ${detailJob.title}`,
          `${detailJob.address || "Job"} assigned to you`,
          "assignment",
          "cm_job",
          detailJob.id
        ),
      ]);
    }
  }

  async function handleDetailStatusChange(newStatus: string) {
    if (!detailJob || detailJob.status === newStatus) return;
    await changeJobStatus(detailJob.id, detailJob.status, newStatus);
    setDetailJob((prev) => prev ? { ...prev, status: newStatus } : prev);
    fetchStatusHistory(detailJob.id);
  }

  async function handleSaveTitle() {
    if (!detailJob || !editTitleValue.trim()) return;
    await updateJobField("title", editTitleValue.trim());
    setEditingTitle(false);
  }

  async function handleAddComment() {
    if (!newComment.trim() || !detailJobId || !user) return;
    const { error } = await supabase.from("comments").insert({
      content: newComment.trim(),
      entity_type: "cm_job",
      entity_id: detailJobId,
      user_id: user.id,
    });
    if (error) {
      toast.error("Failed to add comment");
      return;
    }
    await supabase.from("activity_log").insert({
      action: "comment",
      entity_type: "cm_job",
      entity_id: detailJobId,
      user_id: user.id,
      details: { content: newComment.trim() },
    });
    toast.success("Comment added");
    setNewComment("");
    fetchComments(detailJobId);
  }

  function getStatusLabel(key: string): string {
    return sortedStatuses.find((s) => s.key === key)?.label ?? key;
  }

  function getStatusColor(key: string): string {
    return sortedStatuses.find((s) => s.key === key)?.color ?? "#888";
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
          <Button size="sm" onClick={openNewJobDialog} className="ml-auto">
            <Plus className="h-4 w-4 mr-1" /> New Job
          </Button>
        )}
      </div>

      {/* Kanban Board (PRESERVED drag-and-drop logic) */}
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
                  userRole={role}
                  onCardClick={setDetailJobId}
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

      {/* ==================== New Job Dialog ==================== */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } else setDialogOpen(true); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New CM Job</DialogTitle>
            <DialogDescription>Create a new job for the selected pipeline.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Job Type */}
            <div className="space-y-1">
              <Label>Job Type</Label>
              <Select value={form.job_type_id || selectedTypeId} onValueChange={(v) => setForm({ ...form, job_type_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {jobTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Title */}
            <div className="space-y-1">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            {/* Client + Region */}
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
                <Select value={form.region_id} onValueChange={(v) => setForm({ ...form, region_id: v, building_id: "" })} disabled={!form.client_id}>
                  <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                  <SelectContent>
                    {dialogRegions.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Building */}
            {form.client_id && (
              <div className="space-y-1">
                <Label>Building</Label>
                <Select value={form.building_id} onValueChange={handleBuildingSelect} disabled={!form.client_id}>
                  <SelectTrigger><SelectValue placeholder="Select building (optional)" /></SelectTrigger>
                  <SelectContent>
                    {buildings.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.property_name} — {b.address}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Priority + Assigned */}
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
            {/* Dates */}
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
            {/* Address */}
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
            {/* Description */}
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            {/* PM fields */}
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
            {/* Notes */}
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

      {/* ==================== Job Detail Panel (Sheet) ==================== */}
      <Sheet open={!!detailJobId} onOpenChange={(open) => { if (!open) { setDetailJobId(null); setDetailJob(null); setEditingTitle(false); } }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0">
          {detailLoading || !detailJob ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="p-4 border-b space-y-2">
                <SheetTitle className="sr-only">{detailJob.title}</SheetTitle>
                {editingTitle ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editTitleValue}
                      onChange={(e) => setEditTitleValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveTitle()}
                      autoFocus
                      className="text-lg font-semibold"
                    />
                    <Button size="icon" variant="ghost" onClick={handleSaveTitle}>
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <h2
                    className="text-lg font-semibold cursor-pointer hover:text-primary"
                    onClick={() => { setEditTitleValue(detailJob.title); setEditingTitle(true); }}
                  >
                    {detailJob.title}
                  </h2>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Status dropdown */}
                  <Select value={detailJob.status} onValueChange={handleDetailStatusChange}>
                    <SelectTrigger className="w-auto h-7 text-xs gap-1">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getStatusColor(detailJob.status) }} />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedStatuses.map((s) => (
                        <SelectItem key={s.key} value={s.key}>
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                            {s.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Priority dropdown */}
                  <Select value={detailJob.priority} onValueChange={(v) => updateJobField("priority", v)}>
                    <SelectTrigger className="w-auto h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="details" className="flex-1 flex flex-col">
                <TabsList className="mx-4 mt-2">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                  <TabsTrigger value="comments">Comments</TabsTrigger>
                </TabsList>

                {/* Details Tab */}
                <TabsContent value="details" className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="space-y-3">
                    {detailJob.clients?.name && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Client</Label>
                        <p className="text-sm">{detailJob.clients.name}</p>
                      </div>
                    )}
                    {detailJob.address && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Address</Label>
                        <p className="text-sm">{[detailJob.address, detailJob.city, detailJob.state].filter(Boolean).join(", ")}</p>
                      </div>
                    )}
                    {/* Assigned To */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Assigned To</Label>
                      <Select value={detailJob.assigned_to ?? ""} onValueChange={handleReassign}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Scheduled Date</Label>
                        <Input
                          type="date"
                          value={detailJob.scheduled_date ?? ""}
                          onChange={(e) => updateJobField("scheduled_date", e.target.value || null)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Due Date</Label>
                        <Input
                          type="date"
                          value={detailJob.due_date ?? ""}
                          onChange={(e) => updateJobField("due_date", e.target.value || null)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    {/* PM Info */}
                    {(detailJob.property_manager_name || detailJob.property_manager_phone || detailJob.property_manager_email) && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Property Manager</Label>
                        {detailJob.property_manager_name && <p className="text-sm">{detailJob.property_manager_name}</p>}
                        {detailJob.property_manager_phone && (
                          <a href={`tel:${detailJob.property_manager_phone}`} className="text-sm text-primary hover:underline block">
                            {detailJob.property_manager_phone}
                          </a>
                        )}
                        {detailJob.property_manager_email && (
                          <a href={`mailto:${detailJob.property_manager_email}`} className="text-sm text-primary hover:underline block">
                            {detailJob.property_manager_email}
                          </a>
                        )}
                      </div>
                    )}
                    {/* Description */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Description</Label>
                      <Textarea
                        value={detailJob.description ?? ""}
                        onBlur={(e) => updateJobField("description", e.target.value || null)}
                        onChange={(e) => setDetailJob((prev) => prev ? { ...prev, description: e.target.value } : prev)}
                        rows={3}
                        className="text-sm"
                      />
                    </div>
                    {/* Notes */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Notes</Label>
                      <Textarea
                        value={detailJob.notes ?? ""}
                        onBlur={(e) => updateJobField("notes", e.target.value || null)}
                        onChange={(e) => setDetailJob((prev) => prev ? { ...prev, notes: e.target.value } : prev)}
                        rows={3}
                        className="text-sm"
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* History Tab */}
                <TabsContent value="history" className="flex-1 overflow-y-auto p-4">
                  {statusHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No history yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {statusHistory.map((h) => (
                        <div key={h.id} className="flex items-start gap-3">
                          <span className="mt-1.5 h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: getStatusColor(h.to_status) }} />
                          <div className="text-sm space-y-0.5">
                            <p>
                              <span className="font-medium">{h.changed_by_user?.full_name ?? "System"}</span>
                              {h.from_status
                                ? <> moved to <span className="font-medium">{getStatusLabel(h.to_status)}</span></>
                                : <> created as <span className="font-medium">{getStatusLabel(h.to_status)}</span></>
                              }
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(h.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Comments Tab */}
                <TabsContent value="comments" className="flex-1 flex flex-col overflow-hidden p-4">
                  <div className="flex-1 overflow-y-auto space-y-3 mb-3">
                    {comments.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No comments yet.</p>
                    ) : (
                      comments.map((c) => (
                        <div key={c.id} className="space-y-0.5">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-medium">{c.commenter?.full_name ?? "Unknown"}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-sm">{c.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a comment…"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                      className="text-sm"
                    />
                    <Button size="icon" variant="ghost" onClick={handleAddComment} disabled={!newComment.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
