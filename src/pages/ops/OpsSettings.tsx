import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

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

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "office_manager", label: "Office Manager" },
  { value: "field_ops", label: "Field Ops" },
  { value: "engineer", label: "Engineer" },
];

const roleLabelMap: Record<string, string> = Object.fromEntries(
  ROLE_OPTIONS.map((r) => [r.value, r.label]),
);

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

export default function OpsSettings() {
  const { role } = useAuth();
  const showUsers = role === "admin" || role === "office_manager";

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold">Settings</h1>
      <Tabs defaultValue={showUsers ? "users" : "general"}>
        <TabsList>
          {showUsers && <TabsTrigger value="users">User Management</TabsTrigger>}
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>
        {showUsers && (
          <TabsContent value="users"><UserManagement /></TabsContent>
        )}
        <TabsContent value="general">
          <p className="text-muted-foreground text-sm mt-4">General settings coming soon.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── User Management ─── */

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
