// TODO: create budgets table in Supabase
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
import { Plus, Search, Pencil, Trash2, DollarSign, Info } from "lucide-react";

interface Budget {
  id: string;
  project_name: string;
  client: string;
  amount: number;
  status: "draft" | "approved" | "closed";
  date: string;
}

const MOCK_DATA: Budget[] = [
  { id: "1", project_name: "HQ Roof Replacement", client: "Acme Corp", amount: 250000, status: "approved", date: "2026-03-01" },
  { id: "2", project_name: "Warehouse Repair", client: "Logistics Inc", amount: 45000, status: "draft", date: "2026-04-15" },
  { id: "3", project_name: "Mall Re-Roofing", client: "Retail Holdings", amount: 780000, status: "closed", date: "2025-11-20" },
];

const emptyForm: { project_name: string; client: string; amount: string; status: Budget["status"]; date: string } = { project_name: "", client: "", amount: "", status: "draft", date: "" };

export default function Budgets() {
  const { role } = useAuth();
  const canWrite = role === "admin" || role === "office_manager";

  const [budgets, setBudgets] = useState<Budget[]>(MOCK_DATA);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = budgets.filter((b) => b.project_name.toLowerCase().includes(search.toLowerCase()));

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (b: Budget) => {
    setEditingId(b.id);
    setForm({ project_name: b.project_name, client: b.client, amount: String(b.amount), status: b.status, date: b.date });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.project_name.trim()) { toast.error("Project name is required"); return; }
    const entry: Budget = {
      id: editingId ?? crypto.randomUUID(),
      project_name: form.project_name.trim(),
      client: form.client,
      amount: Number(form.amount) || 0,
      status: form.status,
      date: form.date,
    };
    if (editingId) {
      setBudgets((prev) => prev.map((b) => b.id === editingId ? entry : b));
      toast.success("Budget updated");
    } else {
      setBudgets((prev) => [...prev, entry]);
      toast.success("Budget added");
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    setBudgets((prev) => prev.filter((b) => b.id !== deleteId));
    toast.success("Budget deleted");
    setDeleteId(null);
  };

  const statusColor = (s: string) => s === "approved" ? "default" : s === "closed" ? "secondary" : "outline";
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Budgets</h1>
        {canWrite && <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Budget</Button>}
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
          <Input placeholder="Search budgets…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <DollarSign className="h-10 w-10" /><p>No budgets found</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project Name</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                {canWrite && <TableHead className="w-[100px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.project_name}</TableCell>
                  <TableCell>{b.client}</TableCell>
                  <TableCell>{fmt(b.amount)}</TableCell>
                  <TableCell><Badge variant={statusColor(b.status) as any}>{b.status}</Badge></TableCell>
                  <TableCell>{b.date}</TableCell>
                  {canWrite && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
            <DialogTitle>{editingId ? "Edit Budget" : "Add Budget"}</DialogTitle>
            <DialogDescription>Fill in the budget details below.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5"><Label>Project Name *</Label><Input value={form.project_name} onChange={(e) => setForm({ ...form, project_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5"><Label>Client</Label><Input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Budget["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5"><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
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
          <DialogHeader><DialogTitle>Delete Budget</DialogTitle><DialogDescription>Are you sure? This action cannot be undone.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
