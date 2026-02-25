// TODO: create contractors table in Supabase
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, HardHat, Info } from "lucide-react";

interface Contractor {
  id: string;
  name: string;
  specialty: string;
  phone: string;
  email: string;
  is_active: boolean;
}

const MOCK_DATA: Contractor[] = [
  { id: "1", name: "Apex Roofing Co.", specialty: "Commercial Roofing", phone: "(555) 100-2000", email: "info@apexroofing.com", is_active: true },
  { id: "2", name: "Summit Waterproofing", specialty: "Waterproofing", phone: "(555) 200-3000", email: "jobs@summitwp.com", is_active: true },
  { id: "3", name: "Metro Sheet Metal", specialty: "Sheet Metal", phone: "(555) 300-4000", email: "contact@metrosm.com", is_active: false },
];

const emptyForm = { name: "", specialty: "", phone: "", email: "", is_active: true };

export default function Contractors() {
  const { role } = useAuth();
  const canWrite = role === "admin" || role === "office_manager";

  const [contractors, setContractors] = useState<Contractor[]>(MOCK_DATA);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = contractors.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c: Contractor) => {
    setEditingId(c.id);
    setForm({ name: c.name, specialty: c.specialty, phone: c.phone, email: c.email, is_active: c.is_active });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (editingId) {
      setContractors((prev) => prev.map((c) => c.id === editingId ? { ...c, ...form } : c));
      toast.success("Contractor updated");
    } else {
      setContractors((prev) => [...prev, { id: crypto.randomUUID(), ...form }]);
      toast.success("Contractor added");
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    setContractors((prev) => prev.filter((c) => c.id !== deleteId));
    toast.success("Contractor deleted");
    setDeleteId(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Contractors</h1>
        {canWrite && <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Contractor</Button>}
      </div>

      <Card className="mb-4 border-muted bg-muted/50">
        <CardContent className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <Info className="h-4 w-4 shrink-0" />
          This page uses sample data. Connect to a database table for persistence.
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search contractors…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <HardHat className="h-10 w-10" /><p>No contractors found</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Active</TableHead>
                {canWrite && <TableHead className="w-[100px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.specialty}</TableCell>
                  <TableCell>{c.phone}</TableCell>
                  <TableCell>{c.email}</TableCell>
                  <TableCell><Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? "Yes" : "No"}</Badge></TableCell>
                  {canWrite && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Contractor" : "Add Contractor"}</DialogTitle>
            <DialogDescription>Fill in the contractor details below.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>Specialty</Label><Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Active</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingId ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Contractor</DialogTitle><DialogDescription>Are you sure? This action cannot be undone.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
