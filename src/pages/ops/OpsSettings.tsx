import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, UserX } from "lucide-react";

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
  { value: "inspector", label: "Inspector" },
  { value: "engineer", label: "Engineer" },
  { value: "construction_manager", label: "Construction Manager" },
];

const roleLabelMap: Record<string, string> = Object.fromEntries(
  ROLE_OPTIONS.map((r) => [r.value, r.label]),
);

export default function OpsSettings() {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold">Settings</h1>
      <Tabs defaultValue={isAdmin ? "users" : "general"}>
        <TabsList>
          {isAdmin && <TabsTrigger value="users">User Management</TabsTrigger>}
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>

        {isAdmin && (
          <TabsContent value="users">
            <UserManagement />
          </TabsContent>
        )}

        <TabsContent value="general">
          <p className="text-muted-foreground text-sm mt-4">
            General settings coming soon.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UserManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await supabase.functions.invoke("manage-users", {
      body: { action: "list" },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (res.error) {
      toast.error("Failed to load users");
    } else {
      setUsers(res.data?.users ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
    supabase
      .from("inspectors")
      .select("id, name")
      .then(({ data }) => setInspectors(data ?? []));
  }, [fetchUsers]);

  const handleDeactivate = async (userId: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await supabase.functions.invoke("manage-users", {
      body: { action: "deactivate", user_id: userId },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (res.error || res.data?.error) {
      toast.error(res.data?.error || "Failed to deactivate user");
    } else {
      toast.success("User deactivated");
      fetchUsers();
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Manage employee accounts and roles.
        </p>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add User
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
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{roleLabelMap[u.role] ?? u.role}</TableCell>
                <TableCell>
                  <Badge variant={u.is_active ? "default" : "secondary"}>
                    {u.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {u.is_active && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeactivate(u.id)}
                      title="Deactivate user"
                    >
                      <UserX className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <AddUserDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        inspectors={inspectors}
        onCreated={() => {
          setDialogOpen(false);
          fetchUsers();
        }}
      />
    </div>
  );
}

function AddUserDialog({
  open,
  onOpenChange,
  inspectors,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  inspectors: Inspector[];
  onCreated: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [inspectorId, setInspectorId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setFullName("");
    setEmail("");
    setPassword("");
    setSelectedRole("");
    setInspectorId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await supabase.functions.invoke("manage-users", {
      body: {
        action: "create",
        email,
        password,
        full_name: fullName,
        role: selectedRole,
        inspector_id: inspectorId || undefined,
      },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (res.error || res.data?.error) {
      toast.error(res.data?.error || "Failed to create user");
    } else {
      toast.success("User created successfully");
      reset();
      onCreated();
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
          <DialogDescription>
            Create a new employee account. They can sign in immediately with these credentials.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="add-name">Full Name</Label>
            <Input
              id="add-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-email">Email</Label>
            <Input
              id="add-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-password">Temporary Password</Label>
            <Input
              id="add-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Link to Inspector (optional)</Label>
            <Select value={inspectorId} onValueChange={setInspectorId}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {inspectors.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting || !selectedRole}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Create User"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
