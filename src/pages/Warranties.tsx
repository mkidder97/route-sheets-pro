// TODO: create warranties table in Supabase
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, ShieldCheck, Info } from "lucide-react";

interface Warranty {
  id: string;
  manufacturer: string;
  product: string;
  coverage_years: number;
  expiration: string;
  building: string;
  status: "active" | "expired" | "pending";
}

const MOCK_DATA: Warranty[] = [
  { id: "1", manufacturer: "GAF", product: "TPO Membrane", coverage_years: 20, expiration: "2035-06-15", building: "100 Main St", status: "active" },
  { id: "2", manufacturer: "Firestone", product: "EPDM System", coverage_years: 15, expiration: "2024-01-10", building: "200 Oak Ave", status: "expired" },
  { id: "3", manufacturer: "Carlisle", product: "PVC Roofing", coverage_years: 25, expiration: "2040-09-01", building: "300 Elm Blvd", status: "active" },
];

const emptyForm: { manufacturer: string; product: string; coverage_years: string; expiration: string; building: string; status: Warranty["status"] } = { manufacturer: "", product: "", coverage_years: "10", expiration: "", building: "", status: "active" };

export default function Warranties() {
  const { role } = useAuth();
  const canWrite = role === "admin" || role === "office_manager";

  const [warranties, setWarranties] = useState<Warranty[]>(MOCK_DATA);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = warranties.filter((w) => w.manufacturer.toLowerCase().includes(search.toLowerCase()) || w.product.toLowerCase().includes(search.toLowerCase()));

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (w: Warranty) => {
    setEditingId(w.id);
    setForm({ manufacturer: w.manufacturer, product: w.product, coverage_years: String(w.coverage_years), expiration: w.expiration, building: w.building, status: w.status });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.manufacturer.trim()) { toast.error("Manufacturer is required"); return; }
    const entry: Warranty = {
      id: editingId ?? crypto.randomUUID(),
      manufacturer: form.manufacturer.trim(),
      product: form.product,
      coverage_years: Number(form.coverage_years) || 0,
      expiration: form.expiration,
      building: form.building,
      status: form.status,
    };
    if (editingId) {
      setWarranties((prev) => prev.map((w) => w.id === editingId ? entry : w));
      toast.success("Warranty updated");
    } else {
      setWarranties((prev) => [...prev, entry]);
      toast.success("Warranty added");
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    setWarranties((prev) => prev.filter((w) => w.id !== deleteId));
    toast.success("Warranty deleted");
    setDeleteId(null);
  };

  const statusColor = (s: string) => s === "active" ? "default" : s === "expired" ? "destructive" : "secondary";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Warranties</h1>
        {canWrite && <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Warranty</Button>}
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
          <Input placeholder="Search warranties…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <ShieldCheck className="h-10 w-10" /><p>No warranties found</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Manufacturer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Expiration</TableHead>
                <TableHead>Building</TableHead>
                <TableHead>Status</TableHead>
                {canWrite && <TableHead className="w-[100px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">{w.manufacturer}</TableCell>
                  <TableCell>{w.product}</TableCell>
                  <TableCell>{w.coverage_years} yrs</TableCell>
                  <TableCell>{w.expiration}</TableCell>
                  <TableCell>{w.building}</TableCell>
                  <TableCell><Badge variant={statusColor(w.status)}>{w.status}</Badge></TableCell>
                  {canWrite && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(w)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(w.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
            <DialogTitle>{editingId ? "Edit Warranty" : "Add Warranty"}</DialogTitle>
            <DialogDescription>Fill in the warranty details below.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5"><Label>Manufacturer *</Label><Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Product</Label><Input value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5"><Label>Coverage (years)</Label><Input type="number" value={form.coverage_years} onChange={(e) => setForm({ ...form, coverage_years: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Expiration</Label><Input type="date" value={form.expiration} onChange={(e) => setForm({ ...form, expiration: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5"><Label>Building</Label><Input value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} /></div>
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Warranty["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingId ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Warranty</DialogTitle><DialogDescription>Are you sure? This action cannot be undone.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
