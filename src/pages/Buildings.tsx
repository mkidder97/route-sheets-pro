import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Building2,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  pending: { label: "Pending", badge: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", badge: "bg-info/20 text-info" },
  complete: { label: "Complete", badge: "bg-success/20 text-success" },
  skipped: { label: "Skipped", badge: "bg-warning/20 text-warning" },
  needs_revisit: { label: "Needs Revisit", badge: "bg-destructive/20 text-destructive" },
};

const STATUS_CYCLE: Record<string, string> = {
  pending: "complete",
  complete: "skipped",
  skipped: "needs_revisit",
  needs_revisit: "pending",
  in_progress: "complete",
};

interface BuildingRow extends Tables<"buildings"> {
  clients?: { name: string } | null;
  regions?: { name: string } | null;
  inspectors?: { name: string } | null;
}

export default function Buildings() {
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState("all");
  const [filterRegion, setFilterRegion] = useState("all");
  const [filterInspector, setFilterInspector] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [clients, setClients] = useState<Tables<"clients">[]>([]);
  const [regions, setRegions] = useState<Tables<"regions">[]>([]);
  const [inspectors, setInspectors] = useState<Tables<"inspectors">[]>([]);

  const [noteDialog, setNoteDialog] = useState<{ id: string; status: string } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [bRes, cRes, rRes, iRes] = await Promise.all([
      supabase.from("buildings").select("*, clients(name), regions(name), inspectors(name)").order("property_name"),
      supabase.from("clients").select("*").eq("is_active", true),
      supabase.from("regions").select("*"),
      supabase.from("inspectors").select("*"),
    ]);
    if (bRes.data) setBuildings(bRes.data as BuildingRow[]);
    if (cRes.data) setClients(cRes.data);
    if (rRes.data) setRegions(rRes.data);
    if (iRes.data) setInspectors(iRes.data);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    let result = buildings;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (b) =>
          b.property_name.toLowerCase().includes(s) ||
          b.address.toLowerCase().includes(s) ||
          b.city.toLowerCase().includes(s) ||
          b.zip_code.includes(s)
      );
    }
    if (filterClient !== "all") result = result.filter((b) => b.client_id === filterClient);
    if (filterRegion !== "all") result = result.filter((b) => b.region_id === filterRegion);
    if (filterInspector !== "all") result = result.filter((b) => b.inspector_id === filterInspector);
    if (filterStatus !== "all") result = result.filter((b) => b.inspection_status === filterStatus);
    return result;
  }, [buildings, search, filterClient, filterRegion, filterInspector, filterStatus]);

  const totalCount = filtered.length;
  const completedCount = filtered.filter((b) => b.inspection_status === "complete").length;
  const priorityTotal = filtered.filter((b) => b.is_priority).length;
  const priorityComplete = filtered.filter((b) => b.is_priority && b.inspection_status === "complete").length;

  const handleStatusClick = (id: string, currentStatus: string) => {
    const next = STATUS_CYCLE[currentStatus] || "complete";
    if (next === "skipped" || next === "needs_revisit") {
      setNoteDialog({ id, status: next });
      setNoteText("");
    } else {
      updateStatus(id, next);
    }
  };

  const updateStatus = async (id: string, status: string, notes?: string) => {
    setSaving(true);
    const update: Record<string, unknown> = {
      inspection_status: status,
      completion_date: status === "complete" ? new Date().toISOString() : null,
    };
    if (notes !== undefined) update.inspector_notes = notes;

    const { error } = await supabase.from("buildings").update(update).eq("id", id);
    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success(`Updated to ${STATUS_CONFIG[status]?.label || status}`);
      setBuildings((prev) =>
        prev.map((b) =>
          b.id === id
            ? { ...b, inspection_status: status, inspector_notes: (notes ?? b.inspector_notes) as string | null, completion_date: status === "complete" ? new Date().toISOString() : null }
            : b
        )
      );
    }
    setSaving(false);
    setNoteDialog(null);
    setNoteText("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Buildings</h1>
        <p className="text-muted-foreground mt-1">View and manage all buildings</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalCount}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-success">{completedCount}</p>
            <p className="text-xs text-muted-foreground">{totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}% Complete</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{priorityTotal}</p>
            <p className="text-xs text-muted-foreground">Priority</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{priorityComplete}/{priorityTotal}</p>
            <p className="text-xs text-muted-foreground">Priority Done</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, address, city, zip…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Client" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterRegion} onValueChange={setFilterRegion}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Region" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            {regions.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No buildings found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property Name</TableHead>
                <TableHead className="hidden md:table-cell">Address</TableHead>
                <TableHead className="hidden lg:table-cell">City</TableHead>
                <TableHead className="hidden lg:table-cell">Zip</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Inspector</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b) => {
                const cfg = STATUS_CONFIG[b.inspection_status] || STATUS_CONFIG.pending;
                const isExpanded = expandedId === b.id;
                return (
                  <Collapsible key={b.id} open={isExpanded} onOpenChange={(open) => setExpandedId(open ? b.id : null)} asChild>
                    <>
                      <TableRow className="cursor-pointer">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{b.property_name}</span>
                            {b.is_priority && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">P</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{b.address}</TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">{b.city}</TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">{b.zip_code}</TableCell>
                        <TableCell>
                          <Badge
                            className={`${cfg.badge} border-0 text-xs cursor-pointer`}
                            onClick={(e) => { e.stopPropagation(); handleStatusClick(b.id, b.inspection_status); }}
                          >
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {(b.inspectors as any)?.name || "—"}
                        </TableCell>
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <tr>
                          <td colSpan={7} className="p-0">
                            <div className="p-4 bg-muted/30 border-t border-border space-y-2 text-sm">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                <div><span className="text-muted-foreground">Address:</span> {b.address}, {b.city}, {b.state} {b.zip_code}</div>
                                <div><span className="text-muted-foreground">Client:</span> {(b.clients as any)?.name || "—"}</div>
                                <div><span className="text-muted-foreground">Region:</span> {(b.regions as any)?.name || "—"}</div>
                                {b.square_footage && <div><span className="text-muted-foreground">Sq Ft:</span> {b.square_footage.toLocaleString()}</div>}
                                {b.roof_access_type && <div><span className="text-muted-foreground">Roof Access:</span> {b.roof_access_type.replace("_", " ")}</div>}
                                {b.access_location && <div><span className="text-muted-foreground">Access Location:</span> {b.access_location}</div>}
                                {b.lock_gate_codes && <div><span className="text-muted-foreground">Codes:</span> <span className="font-mono">{b.lock_gate_codes}</span></div>}
                                {b.special_equipment && b.special_equipment.length > 0 && <div><span className="text-muted-foreground">Equipment:</span> {b.special_equipment.join(", ")}</div>}
                                {b.special_notes && <div className="sm:col-span-2"><span className="text-muted-foreground">Notes:</span> {b.special_notes}</div>}
                              </div>
                              {b.inspector_notes && (
                                <div className="p-2 rounded bg-muted text-sm">
                                  <span className="text-muted-foreground">Inspector Notes:</span> {b.inspector_notes}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Note dialog */}
      <Dialog open={!!noteDialog} onOpenChange={(o) => !o && setNoteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {noteDialog?.status === "skipped" ? "Why was this skipped?" : "What needs revisiting?"}
            </DialogTitle>
          </DialogHeader>
          <Textarea placeholder="Enter notes (required)..." value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialog(null)}>Cancel</Button>
            <Button
              disabled={!noteText.trim() || saving}
              onClick={() => { if (noteDialog) updateStatus(noteDialog.id, noteDialog.status, noteText.trim()); }}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
