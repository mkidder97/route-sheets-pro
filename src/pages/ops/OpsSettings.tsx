import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Plus, GripVertical, Trash2 } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/* ─── Shared Types ─── */

interface ManagedUser {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  inspector_id: string | null;
  role: string;
  created_at: string;
}

interface Inspector {
  id: string;
  name: string;
}

interface StatusDef {
  key: string;
  label: string;
  color: string;
  owner_role: string;
  order: number;
}

interface JobType {
  id: string;
  name: string;
  description: string | null;
  statuses: StatusDef[];
  is_active: boolean;
}

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "office_manager", label: "Office Manager" },
  { value: "field_ops", label: "Field Ops" },
  { value: "engineer", label: "Engineer" },
];

const roleLabelMap: Record<string, string> = Object.fromEntries(
  ROLE_OPTIONS.map((r) => [r.value, r.label]),
);

const PRESET_COLORS = [
  "#3498DB", "#E67E22", "#27AE60", "#E74C3C",
  "#9B59B6", "#1ABC9C", "#F1C40F", "#34495E",
  "#95A5A6", "#2ECC71", "#E84393", "#0984E3",
];

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

async function invokeManageUsers(body: Record<string, unknown>) {
  const token = await getToken();
  return supabase.functions.invoke("manage-users", {
    body,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

/* ─── Root Component ─── */

export default function OpsSettings() {
  const { role } = useAuth();
  const showUsers = role === "admin" || role === "office_manager";
  const isAdmin = role === "admin";

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold">Settings</h1>
      <Tabs defaultValue={showUsers ? "users" : "general"}>
        <TabsList>
          {showUsers && <TabsTrigger value="users">User Management</TabsTrigger>}
          {isAdmin && <TabsTrigger value="jobtypes">Job Types</TabsTrigger>}
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>
        {showUsers && (
          <TabsContent value="users"><UserManagement /></TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="jobtypes"><JobTypeManagement /></TabsContent>
        )}
        <TabsContent value="general">
          <p className="text-muted-foreground text-sm mt-4">General settings coming soon.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   User Management (unchanged)
   ═══════════════════════════════════════════════════ */

function UserManagement() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [roleFilter, setRoleFilter] = useState("all");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await invokeManageUsers({ action: "list" });
    if (res.error) toast.error("Failed to load users");
    else setUsers(res.data?.users ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
    supabase.from("inspectors").select("id, name").then(({ data }) => setInspectors(data ?? []));
  }, [fetchUsers]);

  const inspectorMap = Object.fromEntries(inspectors.map((i) => [i.id, i.name]));

  const filtered = users
    .filter((u) => roleFilter === "all" || u.role === roleFilter)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const handleToggleActive = async (u: ManagedUser) => {
    const action = u.is_active ? "deactivate" : "activate";
    const res = await invokeManageUsers({ action, user_id: u.id });
    if (res.error || res.data?.error) toast.error(res.data?.error || `Failed to ${action}`);
    else { toast.success(`User ${action}d`); fetchUsers(); }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">Manage employee accounts and roles.</p>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add User
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Linked Inspector</TableHead>
              <TableHead>Status</TableHead>
              {isAdmin && <TableHead className="w-16">Active</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => (
              <TableRow
                key={u.id}
                className={isAdmin ? "cursor-pointer" : ""}
                onClick={() => isAdmin && setEditUser(u)}
              >
                <TableCell className="font-medium">{u.full_name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{roleLabelMap[u.role] ?? u.role}</TableCell>
                <TableCell>{u.inspector_id ? inspectorMap[u.inspector_id] ?? "—" : "—"}</TableCell>
                <TableCell>
                  <Badge variant={u.is_active ? "default" : "secondary"}>
                    {u.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                {isAdmin && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Switch checked={!!u.is_active} onCheckedChange={() => handleToggleActive(u)} />
                  </TableCell>
                )}
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground py-8">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <AddUserDialog open={addOpen} onOpenChange={setAddOpen} inspectors={inspectors} onCreated={() => { setAddOpen(false); fetchUsers(); }} />
      <EditUserDialog user={editUser} onOpenChange={(o) => !o && setEditUser(null)} inspectors={inspectors} onSaved={() => { setEditUser(null); fetchUsers(); }} />
    </div>
  );
}

/* ─── Add User Dialog ─── */

function AddUserDialog({ open, onOpenChange, inspectors, onCreated }: {
  open: boolean; onOpenChange: (o: boolean) => void; inspectors: Inspector[]; onCreated: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [inspectorId, setInspectorId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => { setFullName(""); setEmail(""); setPassword(""); setPhone(""); setSelectedRole(""); setInspectorId(""); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await invokeManageUsers({
      action: "create", email, password, full_name: fullName, role: selectedRole,
      inspector_id: inspectorId || undefined, phone: phone || undefined,
    });
    if (res.error || res.data?.error) toast.error(res.data?.error || "Failed to create user");
    else { toast.success("User created successfully"); reset(); onCreated(); }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
          <DialogDescription>Create a new employee account.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="add-name">Full Name</Label>
            <Input id="add-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-email">Email</Label>
            <Input id="add-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-password">Temporary Password</Label>
            <Input id="add-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-phone">Phone (optional)</Label>
            <Input id="add-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole} required>
              <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {(selectedRole === "field_ops" || selectedRole === "admin") && (
            <div className="space-y-2">
              <Label>Link to Inspector</Label>
              <Select value={inspectorId} onValueChange={setInspectorId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {inspectors.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={submitting || !selectedRole}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Edit User Dialog ─── */

function EditUserDialog({ user, onOpenChange, inspectors, onSaved }: {
  user: ManagedUser | null; onOpenChange: (o: boolean) => void; inspectors: Inspector[]; onSaved: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [inspectorId, setInspectorId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setPhone(user.phone ?? "");
      setSelectedRole(user.role);
      setInspectorId(user.inspector_id ?? "");
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const res = await invokeManageUsers({
      action: "update", user_id: user.id, full_name: fullName,
      phone: phone || null, role: selectedRole,
      inspector_id: (selectedRole === "field_ops" || selectedRole === "admin") ? inspectorId || null : null,
    });
    if (res.error || res.data?.error) toast.error(res.data?.error || "Failed to update user");
    else { toast.success("User updated"); onSaved(); }
    setSubmitting(false);
  };

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>{user?.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Full Name</Label>
            <Input id="edit-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-phone">Phone</Label>
            <Input id="edit-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {(selectedRole === "field_ops" || selectedRole === "admin") && (
            <div className="space-y-2">
              <Label>Link to Inspector</Label>
              <Select value={inspectorId} onValueChange={setInspectorId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {inspectors.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════
   Job Type Management
   ═══════════════════════════════════════════════════ */

function JobTypeManagement() {
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editType, setEditType] = useState<JobType | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const fetchJobTypes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cm_job_types")
      .select("id, name, description, statuses, is_active")
      .order("name");
    if (error) toast.error("Failed to load job types");
    else setJobTypes((data ?? []).map((d) => ({ ...d, statuses: (d.statuses as unknown as StatusDef[]) ?? [] })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchJobTypes(); }, [fetchJobTypes]);

  const handleToggleActive = async (jt: JobType) => {
    const { error } = await supabase
      .from("cm_job_types")
      .update({ is_active: !jt.is_active })
      .eq("id", jt.id);
    if (error) toast.error("Failed to update");
    else fetchJobTypes();
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">Configure job types and their status pipelines.</p>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Job Type
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Statuses</TableHead>
              <TableHead className="w-16">Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobTypes.map((jt) => (
              <TableRow key={jt.id} className="cursor-pointer" onClick={() => setEditType(jt)}>
                <TableCell className="font-medium">{jt.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                  {jt.description || "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{jt.statuses.length} stages</Badge>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Switch checked={jt.is_active} onCheckedChange={() => handleToggleActive(jt)} />
                </TableCell>
              </TableRow>
            ))}
            {jobTypes.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No job types found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <AddJobTypeDialog open={addOpen} onOpenChange={setAddOpen} onCreated={() => { setAddOpen(false); fetchJobTypes(); }} />
      <EditJobTypeDialog jobType={editType} onOpenChange={(o) => !o && setEditType(null)} onSaved={() => { setEditType(null); fetchJobTypes(); }} />
    </div>
  );
}

/* ─── Add Job Type Dialog ─── */

function AddJobTypeDialog({ open, onOpenChange, onCreated }: {
  open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.from("cm_job_types").insert({
      name,
      description: description || null,
      statuses: [] as unknown as any,
      is_active: true,
    });
    if (error) toast.error("Failed to create job type");
    else { toast.success("Job type created"); setName(""); setDescription(""); onCreated(); }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Job Type</DialogTitle>
          <DialogDescription>Create a new job type with an empty status pipeline.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="jt-name">Name</Label>
            <Input id="jt-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="jt-desc">Description (optional)</Label>
            <Textarea id="jt-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Edit Job Type Dialog ─── */

function EditJobTypeDialog({ jobType, onOpenChange, onSaved }: {
  jobType: JobType | null; onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [statuses, setStatuses] = useState<StatusDef[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (jobType) {
      setName(jobType.name);
      setDescription(jobType.description ?? "");
      setIsActive(jobType.is_active);
      setStatuses([...jobType.statuses].sort((a, b) => a.order - b.order));
    }
  }, [jobType]);

  const statusIds = useMemo(() => statuses.map((s) => s.key), [statuses]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setStatuses((prev) => {
      const oldIdx = prev.findIndex((s) => s.key === active.id);
      const newIdx = prev.findIndex((s) => s.key === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const updateStatus = (key: string, field: keyof StatusDef, value: string | number) => {
    setStatuses((prev) => prev.map((s) => s.key === key ? { ...s, [field]: value } : s));
  };

  const addStatus = () => {
    const nextOrder = statuses.length;
    let baseKey = "new_status";
    let counter = 1;
    while (statuses.some((s) => s.key === baseKey)) {
      baseKey = `new_status_${counter++}`;
    }
    setStatuses((prev) => [...prev, {
      key: baseKey, label: "New Status", color: "#95A5A6", owner_role: "office_manager", order: nextOrder,
    }]);
  };

  const removeStatus = async (key: string) => {
    if (!jobType) return;
    const { count } = await supabase
      .from("cm_jobs")
      .select("id", { count: "exact", head: true })
      .eq("job_type_id", jobType.id)
      .eq("status", key);
    if (count && count > 0) {
      toast.error(`Cannot remove: ${count} job(s) use this status`);
      return;
    }
    setStatuses((prev) => prev.filter((s) => s.key !== key));
  };

  const handleSave = async () => {
    if (!jobType) return;
    setSubmitting(true);
    const ordered = statuses.map((s, i) => ({ ...s, order: i }));
    const { error } = await supabase
      .from("cm_job_types")
      .update({
        name,
        description: description || null,
        is_active: isActive,
        statuses: ordered as unknown as any,
      })
      .eq("id", jobType.id);
    if (error) toast.error("Failed to save");
    else { toast.success("Job type updated"); onSaved(); }
    setSubmitting(false);
  };

  return (
    <Dialog open={!!jobType} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Job Type</DialogTitle>
          <DialogDescription>Configure the job type and its status pipeline.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Top fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ejt-name">Name</Label>
              <Input id="ejt-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Active</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ejt-desc">Description</Label>
            <Textarea id="ejt-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          {/* Statuses */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Status Pipeline</Label>
              <Button type="button" variant="outline" size="sm" onClick={addStatus}>
                <Plus className="h-3 w-3 mr-1" /> Add Status
              </Button>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={statusIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {statuses.map((s) => (
                    <SortableStatusRow
                      key={s.key}
                      status={s}
                      onUpdate={updateStatus}
                      onRemove={removeStatus}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {statuses.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No statuses yet. Add one to get started.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={submitting || !name.trim()}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Sortable Status Row ─── */

function SortableStatusRow({ status, onUpdate, onRemove }: {
  status: StatusDef;
  onUpdate: (key: string, field: keyof StatusDef, value: string | number) => void;
  onRemove: (key: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: status.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border bg-card p-2"
    >
      <button type="button" className="cursor-grab touch-none text-muted-foreground" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>

      <Input
        value={status.label}
        onChange={(e) => onUpdate(status.key, "label", e.target.value)}
        className="h-8 text-sm flex-1 min-w-0"
        placeholder="Label"
      />

      <span className="text-xs text-muted-foreground font-mono whitespace-nowrap hidden sm:block w-24 truncate" title={status.key}>
        {status.key}
      </span>

      <ColorPicker color={status.color} onChange={(c) => onUpdate(status.key, "color", c)} />

      <Select value={status.owner_role} onValueChange={(v) => onUpdate(status.key, "owner_role", v)}>
        <SelectTrigger className="h-8 text-xs w-[120px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLE_OPTIONS.map((r) => (
            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onRemove(status.key)}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

/* ─── Color Picker Popover ─── */

function ColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-8 w-8 rounded-md border shrink-0"
          style={{ backgroundColor: color }}
          title={color}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-4 gap-1">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`h-7 w-7 rounded-md border-2 ${c === color ? "border-primary" : "border-transparent"}`}
              style={{ backgroundColor: c }}
              onClick={() => { onChange(c); setOpen(false); }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
