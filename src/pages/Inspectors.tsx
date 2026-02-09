import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Users, Plus, Pencil, Trash2, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

interface InspectorWithStats extends Tables<"inspectors"> {
  region_name: string;
  building_count: number;
  completed_count: number;
  priority_count: number;
  buildings_by_status: Record<string, { id: string; property_name: string; address: string }[]>;
}

export default function Inspectors() {
  const [inspectors, setInspectors] = useState<InspectorWithStats[]>([]);
  const [regions, setRegions] = useState<Tables<"regions">[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Add/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formRegion, setFormRegion] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<InspectorWithStats | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [iRes, rRes, bRes] = await Promise.all([
      supabase.from("inspectors").select("*").order("name"),
      supabase.from("regions").select("*"),
      supabase.from("buildings").select("id, property_name, address, inspector_id, inspection_status, is_priority"),
    ]);

    const regionMap = new Map((rRes.data || []).map((r) => [r.id, r.name]));
    setRegions(rRes.data || []);

    const allBuildings = bRes.data || [];

    const result: InspectorWithStats[] = (iRes.data || []).map((insp) => {
      const myBuildings = allBuildings.filter((b) => b.inspector_id === insp.id);
      const byStatus: Record<string, { id: string; property_name: string; address: string }[]> = {};
      for (const b of myBuildings) {
        const s = b.inspection_status || "pending";
        if (!byStatus[s]) byStatus[s] = [];
        byStatus[s].push({ id: b.id, property_name: b.property_name, address: b.address });
      }
      return {
        ...insp,
        region_name: regionMap.get(insp.region_id || "") || "—",
        building_count: myBuildings.length,
        completed_count: myBuildings.filter((b) => b.inspection_status === "complete").length,
        priority_count: myBuildings.filter((b) => b.is_priority).length,
        buildings_by_status: byStatus,
      };
    });

    setInspectors(result);
    setLoading(false);
  };

  const openAdd = () => {
    setEditingId(null);
    setFormName("");
    setFormRegion("");
    setDialogOpen(true);
  };

  const openEdit = (insp: InspectorWithStats) => {
    setEditingId(insp.id);
    setFormName(insp.name);
    setFormRegion(insp.region_id || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from("inspectors")
        .update({ name: formName.trim(), region_id: formRegion || null })
        .eq("id", editingId);
      if (error) toast.error("Update failed");
      else toast.success("Inspector updated");
    } else {
      const { error } = await supabase
        .from("inspectors")
        .insert({ name: formName.trim(), region_id: formRegion || null });
      if (error) toast.error("Create failed");
      else toast.success("Inspector added");
    }

    setSaving(false);
    setDialogOpen(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("inspectors").delete().eq("id", deleteTarget.id);
    if (error) toast.error("Delete failed");
    else toast.success("Inspector deleted");
    setDeleteTarget(null);
    loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inspectors</h1>
          <p className="text-muted-foreground mt-1">Manage inspectors and track progress</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" /> Add Inspector
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : inspectors.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No inspectors yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Region</TableHead>
                <TableHead className="text-center">Buildings</TableHead>
                <TableHead className="text-center hidden sm:table-cell">Completion</TableHead>
                <TableHead className="text-center hidden sm:table-cell">Priority</TableHead>
                <TableHead className="w-24">Actions</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inspectors.map((insp) => {
                const pct = insp.building_count > 0 ? Math.round((insp.completed_count / insp.building_count) * 100) : 0;
                const isExpanded = expandedId === insp.id;
                return (
                  <Collapsible key={insp.id} open={isExpanded} onOpenChange={(open) => setExpandedId(open ? insp.id : null)} asChild>
                    <>
                      <TableRow>
                        <TableCell className="font-medium">{insp.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{insp.region_name}</TableCell>
                        <TableCell className="text-center">{insp.building_count}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex items-center gap-2 justify-center">
                            <Progress value={pct} className="h-2 w-16" />
                            <span className="text-xs text-muted-foreground">{pct}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center hidden sm:table-cell">{insp.priority_count}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(insp)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => setDeleteTarget(insp)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
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
                            <div className="p-4 bg-muted/30 border-t border-border space-y-3">
                              {Object.entries(insp.buildings_by_status).length === 0 ? (
                                <p className="text-sm text-muted-foreground">No buildings assigned.</p>
                              ) : (
                                Object.entries(insp.buildings_by_status).map(([status, blds]) => (
                                  <div key={status}>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                      {status.replace("_", " ")} ({blds.length})
                                    </p>
                                    <div className="space-y-1">
                                      {blds.map((b) => (
                                        <div key={b.id} className="text-sm pl-2 border-l-2 border-border">
                                          <span className="font-medium">{b.property_name}</span>
                                          <span className="text-muted-foreground ml-2">{b.address}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Inspector" : "Add Inspector"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Inspector name" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Region</label>
              <Select value={formRegion} onValueChange={setFormRegion}>
                <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                <SelectContent>
                  {regions.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formName.trim() || saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.building_count > 0
                ? `This inspector has ${deleteTarget.building_count} assigned buildings. They will become unassigned.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
