import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft, Star, Bell, UserRound, ChevronDown, ChevronRight,
  MessageSquare, X, Download, MapPin, Pencil, Building2, CheckCircle,
  Clock, AlertCircle, Loader2,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";

type Campaign = {
  id: string;
  client_id: string;
  region_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  inspection_type: string;
  total_buildings: number;
  completed_buildings: number;
  notes: string | null;
  clients?: { name: string } | null;
  regions?: { name: string } | null;
};

type BuildingData = {
  id: string;
  stop_number: string | null;
  property_name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  building_code: string | null;
  roof_group: string | null;
  square_footage: number | null;
  roof_access_type: string | null;
  roof_access_description: string | null;
  access_location: string | null;
  lock_gate_codes: string | null;
  property_manager_name: string | null;
  property_manager_phone: string | null;
  property_manager_email: string | null;
  special_notes: string | null;
  special_equipment: string[] | null;
  requires_advance_notice: boolean | null;
  requires_escort: boolean | null;
};

type CampaignBuilding = {
  id: string;
  inspection_status: string;
  inspector_id: string | null;
  scheduled_week: string | null;
  is_priority: boolean;
  completion_date: string | null;
  inspector_notes: string | null;
  photo_url: string | null;
  building: BuildingData;
  inspector: { name: string } | null;
};

type Inspector = { id: string; name: string };

type Comment = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  author_name: string;
};

const BUILDING_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "complete", label: "Complete" },
  { value: "skipped", label: "Skipped" },
  { value: "needs_revisit", label: "Needs Revisit" },
];

const BUILDING_STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-500/15 text-slate-400",
  in_progress: "bg-blue-500/15 text-blue-400",
  complete: "bg-emerald-500/15 text-emerald-400",
  skipped: "bg-red-500/15 text-red-400",
  needs_revisit: "bg-amber-500/15 text-amber-400",
};

const CAMPAIGN_STATUS_OPTIONS = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "complete", label: "Complete" },
  { value: "on_hold", label: "On Hold" },
];

const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  planning: "bg-slate-500/15 text-slate-400",
  active: "bg-blue-500/15 text-blue-400",
  complete: "bg-emerald-500/15 text-emerald-400",
  on_hold: "bg-amber-500/15 text-amber-400",
};

const TYPE_BADGE_COLORS: Record<string, string> = {
  annual: "border-blue-500 text-blue-300",
  due_diligence: "border-purple-500 text-purple-300",
  survey: "border-teal-500 text-teal-300",
  storm: "border-red-500 text-red-300",
};

const INSPECTION_TYPE_LABELS: Record<string, string> = {
  annual: "Annual",
  due_diligence: "Due Diligence",
  survey: "Survey",
  storm: "Storm",
};

const STATUS_CYCLE: Record<string, string> = {
  pending: "in_progress",
  in_progress: "complete",
  complete: "skipped",
  skipped: "needs_revisit",
  needs_revisit: "pending",
};

type SortKey = "stop_number" | "property_name" | "city" | "inspection_status" | "scheduled_week";

const BUILDING_LEVEL_SORT_KEYS = new Set(["stop_number", "property_name", "city"]);

export default function OpsCampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const canEdit = role === "admin" || role === "office_manager";

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [buildings, setBuildings] = useState<CampaignBuilding[]>([]);
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Comments
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterInspector, setFilterInspector] = useState("all");
  const [search, setSearch] = useState("");
  const [priorityOnly, setPriorityOnly] = useState(false);

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("stop_number");
  const [sortAsc, setSortAsc] = useState(true);

  // Auto-sync guard
  const syncedRef = useRef(false);

  // Status note confirmation dialog
  const [pendingStatusRow, setPendingStatusRow] = useState<{
    cbId: string; buildingId: string; oldStatus: string; newStatus: string;
  } | null>(null);
  const [pendingNote, setPendingNote] = useState("");

  // Edit campaign dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", status: "", end_date: "", notes: "" });
  const [editSaving, setEditSaving] = useState(false);

  // Notes tab
  const [notesEdit, setNotesEdit] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);

  // Reset sync guard when campaign changes
  useEffect(() => {
    syncedRef.current = false;
  }, [campaign?.id]);

  // Auto-sync campaign totals when buildings load
  useEffect(() => {
    if (!campaign || buildings.length === 0 || syncedRef.current) return;
    syncedRef.current = true;

    const total = buildings.length;
    const completed = buildings.filter((b) => b.inspection_status === "complete").length;

    const needsCountUpdate =
      total !== campaign.total_buildings || completed !== campaign.completed_buildings;
    const shouldAutoComplete =
      completed === total && total > 0 && campaign.status !== "on_hold" && campaign.status !== "complete";

    if (!needsCountUpdate && !shouldAutoComplete) return;

    (async () => {
      const updatePayload: Record<string, any> = {
        total_buildings: total,
        completed_buildings: completed,
      };
      if (shouldAutoComplete) {
        updatePayload.status = "complete";
      }

      const { error } = await supabase
        .from("inspection_campaigns")
        .update(updatePayload)
        .eq("id", campaign.id);

      if (!error) {
        setCampaign((prev) =>
          prev ? { ...prev, ...updatePayload } : prev
        );
        if (shouldAutoComplete) {
          toast.success("Campaign marked complete!");
        }
      }
    })();
  }, [buildings, campaign]);

  useEffect(() => {
    if (id) {
      fetchCampaign();
      fetchInspectors();
      fetchComments();
    }
  }, [id]);

  useEffect(() => {
    if (campaign) fetchBuildings();
  }, [campaign?.id]);

  async function fetchCampaign() {
    const { data, error } = await supabase
      .from("inspection_campaigns")
      .select("*, clients(name), regions(name)")
      .eq("id", id!)
      .single();
    if (error) {
      toast.error("Campaign not found");
      navigate("/ops/jobs");
      return;
    }
    setCampaign(data as Campaign);
    // Sync point 1: seed notes tab
    setNotesText((data as Campaign).notes ?? "");
  }

  async function fetchBuildings() {
    if (!campaign) return;
    setLoading(true);
    const { data } = await supabase
      .from("campaign_buildings" as any)
      .select(`
        id,
        inspection_status,
        inspector_id,
        scheduled_week,
        is_priority,
        completion_date,
        inspector_notes,
        photo_url,
        building:buildings (
          id, stop_number, property_name, address, city, state, zip_code,
          building_code, roof_group, square_footage,
          roof_access_type, roof_access_description, access_location, lock_gate_codes,
          property_manager_name, property_manager_phone, property_manager_email,
          special_notes, special_equipment, requires_advance_notice, requires_escort
        ),
        inspector:inspectors ( name )
      `)
      .eq("campaign_id", id!)
      .order("created_at");
    setBuildings((data as unknown as CampaignBuilding[]) ?? []);
    setLoading(false);
  }

  async function fetchInspectors() {
    const { data } = await supabase.from("inspectors").select("id, name").order("name");
    if (data) setInspectors(data);
  }

  async function fetchComments() {
    if (!id) return;
    const { data } = await supabase
      .from("comments" as any)
      .select("id, user_id, content, created_at")
      .eq("entity_type", "campaign")
      .eq("entity_id", id)
      .order("created_at", { ascending: true });

    if (!data || (data as any[]).length === 0) {
      setComments([]);
      return;
    }

    const userIds = [...new Set((data as any[]).map((c: any) => c.user_id))];
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, full_name")
      .in("id", userIds);

    const nameMap: Record<string, string> = {};
    (profiles ?? []).forEach((p: any) => { nameMap[p.id] = p.full_name; });

    setComments(
      (data as any[]).map((c: any) => ({
        id: c.id,
        user_id: c.user_id,
        content: c.content,
        created_at: c.created_at,
        author_name: nameMap[c.user_id] ?? "Unknown",
      }))
    );
  }

  async function postComment() {
    if (!newComment.trim() || !user || !id) return;
    setPostingComment(true);
    const { error } = await supabase.from("comments" as any).insert({
      user_id: user.id,
      entity_type: "campaign",
      entity_id: id,
      content: newComment.trim(),
    } as any);
    setPostingComment(false);
    if (error) {
      toast.error("Failed to post comment");
    } else {
      setNewComment("");
      fetchComments();
    }
  }

  async function updateBuildingStatus(
    campaignBuildingId: string,
    buildingId: string,
    oldStatus: string,
    newStatus: string
  ) {
    if (!campaign) return;
    const today = new Date().toISOString().split("T")[0];

    const { error: cbErr } = await supabase
      .from("campaign_buildings" as any)
      .update({
        inspection_status: newStatus,
        completion_date: newStatus === "complete" ? today : null,
      } as any)
      .eq("id", campaignBuildingId);
    if (cbErr) {
      toast.error("Failed to update status");
      return;
    }

    await supabase
      .from("buildings")
      .update({
        inspection_status: newStatus,
        completion_date: newStatus === "complete" ? today : null,
      })
      .eq("id", buildingId);

    await recalcCampaignCount();

    await supabase.from("activity_log").insert({
      action: "status_change",
      entity_type: "building",
      entity_id: buildingId,
      user_id: user?.id ?? null,
      details: { old_status: oldStatus, new_status: newStatus, campaign_id: campaign.id },
    });

    setBuildings((prev) =>
      prev.map((b) =>
        b.id === campaignBuildingId
          ? { ...b, inspection_status: newStatus, completion_date: newStatus === "complete" ? today : null }
          : b
      )
    );
    toast.success("Status updated");
  }

  async function recalcCampaignCount() {
    if (!campaign) return;
    const { count } = await supabase
      .from("campaign_buildings" as any)
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaign.id)
      .eq("inspection_status", "complete");

    const completed = count ?? 0;
    await supabase
      .from("inspection_campaigns")
      .update({ completed_buildings: completed })
      .eq("id", campaign.id);

    setCampaign((prev) => prev ? { ...prev, completed_buildings: completed } : prev);
  }

  function handleStatusBadgeClick(cb: CampaignBuilding) {
    const next = STATUS_CYCLE[cb.inspection_status] ?? "pending";
    if (next === "skipped" || next === "needs_revisit") {
      setPendingStatusRow({
        cbId: cb.id,
        buildingId: cb.building.id,
        oldStatus: cb.inspection_status,
        newStatus: next,
      });
      setPendingNote("");
    } else {
      updateBuildingStatus(cb.id, cb.building.id, cb.inspection_status, next);
    }
  }

  // Bulk actions
  async function bulkUpdateStatus(newStatus: string) {
    if (!campaign || selectedIds.size === 0) return;
    const today = new Date().toISOString().split("T")[0];

    for (const cbId of selectedIds) {
      const row = buildings.find((b) => b.id === cbId);
      if (!row || row.inspection_status === newStatus) continue;

      await supabase
        .from("campaign_buildings" as any)
        .update({
          inspection_status: newStatus,
          completion_date: newStatus === "complete" ? today : null,
        } as any)
        .eq("id", cbId);

      await supabase
        .from("buildings")
        .update({
          inspection_status: newStatus,
          completion_date: newStatus === "complete" ? today : null,
        })
        .eq("id", row.building.id);

      await supabase.from("activity_log").insert({
        action: "status_change",
        entity_type: "building",
        entity_id: row.building.id,
        user_id: user?.id ?? null,
        details: { old_status: row.inspection_status, new_status: newStatus, campaign_id: campaign.id },
      });
    }

    await recalcCampaignCount();
    setSelectedIds(new Set());
    await fetchBuildings();
    toast.success(`Updated ${selectedIds.size} building(s)`);
  }

  async function bulkReassignInspector(inspectorId: string) {
    if (!campaign || selectedIds.size === 0) return;

    for (const cbId of selectedIds) {
      const row = buildings.find((b) => b.id === cbId);
      if (!row) continue;

      await supabase
        .from("campaign_buildings" as any)
        .update({ inspector_id: inspectorId } as any)
        .eq("id", cbId);

      await supabase.from("activity_log").insert({
        action: "inspector_reassign",
        entity_type: "building",
        entity_id: row.building.id,
        user_id: user?.id ?? null,
        details: { old_inspector_id: row.inspector_id, new_inspector_id: inspectorId, campaign_id: campaign.id },
      });
    }

    setSelectedIds(new Set());
    await fetchBuildings();
    toast.success(`Reassigned ${selectedIds.size} building(s)`);
  }

  function toggleSelect(cbId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cbId)) next.delete(cbId);
      else next.add(cbId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((b) => b.id)));
    }
  }

  function handleExport() {
    if (!campaign || buildings.length === 0) return;
    const rows = buildings.map((b) => ({
      "Stop #": b.building.stop_number ?? "",
      "Property Name": b.building.property_name,
      "Address": b.building.address,
      "City": b.building.city,
      "State": b.building.state,
      "Zip": b.building.zip_code,
      "Status": b.inspection_status,
      "Inspector": b.inspector?.name ?? "",
      "Scheduled Week": b.scheduled_week ?? "",
      "Building Code": b.building.building_code ?? "",
      "Roof Group": b.building.roof_group ?? "",
      "Sq Footage": b.building.square_footage ?? "",
      "Access Type": b.building.roof_access_type ?? "",
      "Access Description": b.building.roof_access_description ?? "",
      "Access Location": b.building.access_location ?? "",
      "Lock/Gate Codes": b.building.lock_gate_codes ?? "",
      "Property Manager": b.building.property_manager_name ?? "",
      "PM Phone": b.building.property_manager_phone ?? "",
      "PM Email": b.building.property_manager_email ?? "",
      "Priority": b.is_priority ? "Yes" : "No",
      "24H Notice": b.building.requires_advance_notice ? "Yes" : "No",
      "Escort Required": b.building.requires_escort ? "Yes" : "No",
      "Special Equipment": b.building.special_equipment?.join(", ") ?? "",
      "Special Notes": b.building.special_notes ?? "",
      "Inspector Notes": b.inspector_notes ?? "",
      "Completion Date": b.completion_date ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Buildings");
    XLSX.writeFile(wb, `${campaign.name} - Export - ${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  async function handleEditSave() {
    if (!campaign) return;
    setEditSaving(true);
    const { error } = await supabase
      .from("inspection_campaigns")
      .update({
        name: editForm.name,
        status: editForm.status,
        end_date: editForm.end_date,
        notes: editForm.notes || null,
      })
      .eq("id", campaign.id);
    setEditSaving(false);
    if (error) {
      toast.error("Failed to save changes");
      return;
    }
    setCampaign((prev) =>
      prev ? { ...prev, name: editForm.name, status: editForm.status, end_date: editForm.end_date, notes: editForm.notes || null } : prev
    );
    // Sync point 2: update notes tab
    setNotesText(editForm.notes ?? "");
    setEditDialogOpen(false);
    toast.success("Campaign updated");
  }

  async function handleNotesSave() {
    if (!campaign) return;
    setNotesSaving(true);
    const { error } = await supabase
      .from("inspection_campaigns")
      .update({ notes: notesText || null })
      .eq("id", campaign.id);
    setNotesSaving(false);
    if (error) {
      toast.error("Failed to save notes");
      return;
    }
    // Sync point 3: update campaign state and edit form
    setCampaign((prev) => prev ? { ...prev, notes: notesText || null } : prev);
    setEditForm((prev) => ({ ...prev, notes: notesText }));
    setNotesEdit(false);
    toast.success("Notes saved");
  }

  const filtered = useMemo(() => {
    let result = buildings;
    if (filterStatus !== "all") result = result.filter((b) => b.inspection_status === filterStatus);
    if (filterInspector !== "all") result = result.filter((b) => b.inspector_id === filterInspector);
    if (priorityOnly) result = result.filter((b) => b.is_priority);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) =>
          b.building.property_name.toLowerCase().includes(q) ||
          b.building.address.toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      let aVal: string;
      let bVal: string;
      if (BUILDING_LEVEL_SORT_KEYS.has(sortKey)) {
        aVal = ((a.building as any)[sortKey] ?? "") as string;
        bVal = ((b.building as any)[sortKey] ?? "") as string;
      } else {
        aVal = ((a as any)[sortKey] ?? "") as string;
        bVal = ((b as any)[sortKey] ?? "") as string;
      }
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

    return result;
  }, [buildings, filterStatus, filterInspector, priorityOnly, search, sortKey, sortAsc]);

  // KPI computations
  const kpiTotal = buildings.length;
  const kpiComplete = buildings.filter((b) => b.inspection_status === "complete").length;
  const kpiInProgress = buildings.filter((b) => b.inspection_status === "in_progress").length;
  const kpiPending = buildings.filter((b) => b.inspection_status === "pending").length;

  if (!campaign) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const pct = campaign.total_buildings > 0
    ? Math.round((campaign.completed_buildings / campaign.total_buildings) * 100)
    : 0;

  const allFilteredSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/inspections/campaigns")} className="text-slate-400 hover:text-slate-200">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Campaigns
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-100">{campaign.name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={`${CAMPAIGN_STATUS_COLORS[campaign.status] ?? ""} border-0`}>
                {CAMPAIGN_STATUS_OPTIONS.find((s) => s.value === campaign.status)?.label ?? campaign.status}
              </Badge>
              <span className="text-sm text-slate-400">{campaign.clients?.name}</span>
              <span className="text-slate-600">·</span>
              <Badge variant="outline" className={TYPE_BADGE_COLORS[campaign.inspection_type] ?? ""}>
                {INSPECTION_TYPE_LABELS[campaign.inspection_type] ?? campaign.inspection_type}
              </Badge>
            </div>
            <p className="text-xs text-slate-500">
              {format(new Date(campaign.start_date), "MMM d, yyyy")} – {format(new Date(campaign.end_date), "MMM d, yyyy")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={buildings.length === 0} className="border-slate-700 text-slate-300 hover:bg-slate-800">
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
                onClick={() => {
                  setEditForm({
                    name: campaign.name,
                    status: campaign.status,
                    end_date: campaign.end_date,
                    notes: campaign.notes ?? "",
                  });
                  setEditDialogOpen(true);
                }}
              >
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
            )}
          </div>
        </div>
        <div className="space-y-1 max-w-md">
          <Progress value={pct} className="h-1.5" />
          <p className="text-xs text-slate-500">
            {campaign.completed_buildings} of {campaign.total_buildings} complete ({pct}%)
          </p>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Building2} iconBg="bg-slate-500/15" iconColor="text-slate-400" label="Total" value={kpiTotal} />
        <KpiCard icon={CheckCircle} iconBg="bg-emerald-500/15" iconColor="text-emerald-400" label="Complete" value={kpiComplete} />
        <KpiCard icon={Clock} iconBg="bg-blue-500/15" iconColor="text-blue-400" label="In Progress" value={kpiInProgress} />
        <KpiCard icon={AlertCircle} iconBg="bg-slate-400/15" iconColor="text-slate-400" label="Pending" value={kpiPending} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="buildings" className="space-y-4">
        <TabsList className="bg-slate-800 border border-slate-700/50">
          <TabsTrigger value="buildings" className="data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100 text-slate-400">Buildings</TabsTrigger>
          <TabsTrigger value="notes" className="data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100 text-slate-400">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="buildings" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px] bg-slate-900 border-slate-600">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {BUILDING_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterInspector} onValueChange={setFilterInspector}>
              <SelectTrigger className="w-[180px] bg-slate-900 border-slate-600">
                <SelectValue placeholder="All Inspectors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Inspectors</SelectItem>
                {inspectors.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Search property or address…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-[220px] bg-slate-900 border-slate-600"
            />

            <div className="flex items-center gap-2">
              <Switch checked={priorityOnly} onCheckedChange={setPriorityOnly} id="priority-toggle" />
              <Label htmlFor="priority-toggle" className="text-sm text-slate-400">Priority Only</Label>
            </div>
          </div>

          {/* Buildings Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center py-8 text-slate-500">No buildings match the current filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700/50">
                  {canEdit && (
                    <TableHead className="w-8">
                      <Checkbox
                        checked={allFilteredSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                  )}
                  <TableHead className="w-8" />
                  <SortableHead label="Stop #" sortKey="stop_number" current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <SortableHead label="Property Name" sortKey="property_name" current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <SortableHead label="Address" sortKey="city" current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <SortableHead label="Status" sortKey="inspection_status" current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400">Inspector</TableHead>
                  <SortableHead label="Week" sortKey="scheduled_week" current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400">Flags</TableHead>
                  <TableHead className="w-10 text-xs uppercase tracking-wider text-slate-400">Nav</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((b) => (
                  <Collapsible key={b.id} open={expandedId === b.id} onOpenChange={(open) => setExpandedId(open ? b.id : null)} asChild>
                    <>
                      <CollapsibleTrigger asChild>
                        <TableRow className="cursor-pointer hover:bg-slate-700/50 border-slate-700/50">
                          {canEdit && (
                            <TableCell className="w-8" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedIds.has(b.id)}
                                onCheckedChange={() => toggleSelect(b.id)}
                                aria-label={`Select ${b.building.property_name}`}
                              />
                            </TableCell>
                          )}
                          <TableCell className="w-8">
                            {expandedId === b.id ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                          </TableCell>
                          <TableCell className="text-slate-300">{b.building.stop_number ?? "—"}</TableCell>
                          <TableCell className="font-medium text-slate-100">{b.building.property_name}</TableCell>
                          <TableCell className="text-slate-300">{b.building.city}, {b.building.state}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {canEdit ? (
                              <Badge
                                className={`cursor-pointer ${BUILDING_STATUS_COLORS[b.inspection_status] ?? ""}`}
                                onClick={() => handleStatusBadgeClick(b)}
                              >
                                {BUILDING_STATUS_OPTIONS.find((s) => s.value === b.inspection_status)?.label ?? b.inspection_status}
                              </Badge>
                            ) : (
                              <Badge className={BUILDING_STATUS_COLORS[b.inspection_status] ?? ""}>
                                {BUILDING_STATUS_OPTIONS.find((s) => s.value === b.inspection_status)?.label ?? b.inspection_status}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-300">{b.inspector?.name ?? "—"}</TableCell>
                          <TableCell className="text-slate-300">{b.scheduled_week ?? "—"}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {b.is_priority && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                              {b.building.requires_advance_notice && <Bell className="h-4 w-4 text-slate-500" />}
                              {b.building.requires_escort && <UserRound className="h-4 w-4 text-slate-500" />}
                            </div>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" onClick={() => {
                              const addr = encodeURIComponent(`${b.building.address}, ${b.building.city}, ${b.building.state} ${b.building.zip_code}`);
                              window.open(`https://www.google.com/maps/dir/?api=1&destination=${addr}`, "_blank");
                            }}>
                              <MapPin className="h-4 w-4 text-primary" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <tr>
                          <td colSpan={canEdit ? 11 : 10} className="bg-slate-800/50 p-4 border-slate-700/50">
                            <BuildingDetail row={b} />
                          </td>
                        </tr>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Comments Section */}
          <div className="space-y-4 border-t border-slate-700/50 pt-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-slate-500" />
              <h2 className="text-lg font-semibold text-slate-100">Comments</h2>
            </div>

            {comments.length === 0 ? (
              <p className="text-sm text-slate-500">No comments yet.</p>
            ) : (
              <div className="space-y-3">
                {comments.map((c) => (
                  <div key={c.id} className="space-y-0.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-slate-200">{c.author_name}</span>
                      <span className="text-xs text-slate-500">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300">{c.content}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Textarea
                placeholder="Add a comment…"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[60px] bg-slate-900 border-slate-600"
              />
              <Button
                onClick={postComment}
                disabled={!newComment.trim() || postingComment}
                className="self-end"
              >
                Post
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notes">
          <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-6">
            {notesEdit ? (
              <div className="space-y-3">
                <Textarea
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="Campaign notes…"
                  className="min-h-[200px] bg-slate-900 border-slate-600 text-slate-200"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleNotesSave} disabled={notesSaving}>
                    {notesSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Save
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => {
                    setNotesText(campaign.notes ?? "");
                    setNotesEdit(false);
                  }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                {notesText ? (
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{notesText}</p>
                ) : (
                  <p className="text-sm text-slate-500">No notes yet.</p>
                )}
                {canEdit && (
                  <Button variant="ghost" size="sm" className="mt-3 text-slate-400" onClick={() => setNotesEdit(true)}>
                    <Pencil className="h-3 w-3 mr-1" /> Edit Notes
                  </Button>
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Floating Bulk Action Bar */}
      {canEdit && selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 shadow-lg">
          <span className="text-sm font-medium text-slate-200">{selectedIds.size} selected</span>

          <Select onValueChange={bulkUpdateStatus}>
            <SelectTrigger className="h-8 w-[150px] bg-slate-900 border-slate-600">
              <SelectValue placeholder="Update Status" />
            </SelectTrigger>
            <SelectContent>
              {BUILDING_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select onValueChange={bulkReassignInspector}>
            <SelectTrigger className="h-8 w-[170px] bg-slate-900 border-slate-600">
              <SelectValue placeholder="Reassign Inspector" />
            </SelectTrigger>
            <SelectContent>
              {inspectors.map((i) => (
                <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="text-slate-400">
            <X className="h-4 w-4 mr-1" /> Clear
          </Button>
        </div>
      )}

      {/* Status Note Confirmation Dialog */}
      <Dialog open={!!pendingStatusRow} onOpenChange={(open) => {
        if (!open) { setPendingStatusRow(null); setPendingNote(""); }
      }}>
        <DialogContent className="max-w-sm bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              Add note for "{pendingStatusRow?.newStatus?.replace("_", " ")}" status
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={pendingNote}
            onChange={(e) => setPendingNote(e.target.value)}
            placeholder="Required note…"
            className="bg-slate-900 border-slate-600 min-h-[80px]"
          />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => {
              setPendingStatusRow(null);
              setPendingNote("");
            }}>Cancel</Button>
            <Button size="sm" disabled={!pendingNote.trim()} onClick={async () => {
              if (!pendingStatusRow) return;
              await updateBuildingStatus(
                pendingStatusRow.cbId,
                pendingStatusRow.buildingId,
                pendingStatusRow.oldStatus,
                pendingStatusRow.newStatus
              );
              await supabase
                .from("campaign_buildings" as any)
                .update({ inspector_notes: pendingNote.trim() } as any)
                .eq("id", pendingStatusRow.cbId);
              // Update local state with note
              setBuildings((prev) =>
                prev.map((b) =>
                  b.id === pendingStatusRow.cbId
                    ? { ...b, inspector_notes: pendingNote.trim() }
                    : b
                )
              );
              setPendingStatusRow(null);
              setPendingNote("");
            }}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Campaign Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Edit Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-slate-300">Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="bg-slate-900 border-slate-600"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Status</Label>
              <Select value={editForm.status} onValueChange={(val) => setEditForm({ ...editForm, status: val })}>
                <SelectTrigger className="bg-slate-900 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">End Date</Label>
              <Input
                type="date"
                value={editForm.end_date}
                onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })}
                className="bg-slate-900 border-slate-600"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Notes</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Campaign notes…"
                className="bg-slate-900 border-slate-600 min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleEditSave} disabled={editSaving || !editForm.name.trim()}>
              {editSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Helper components ---

function KpiCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-5">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
          <p className="text-4xl font-bold text-white leading-none">{value}</p>
        </div>
      </div>
    </div>
  );
}

function SortableHead({
  label,
  sortKey,
  current,
  asc,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  asc: boolean;
  onSort: (key: SortKey) => void;
}) {
  return (
    <TableHead
      className="cursor-pointer select-none text-xs uppercase tracking-wider text-slate-400"
      onClick={() => onSort(sortKey)}
    >
      {label} {current === sortKey ? (asc ? "↑" : "↓") : ""}
    </TableHead>
  );
}

function BuildingDetail({ row }: { row: CampaignBuilding }) {
  const b = row.building;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
      <div className="space-y-1">
        <p className="font-medium text-slate-200">Address</p>
        <p className="text-slate-400">{b.address}</p>
        <p className="text-slate-400">{b.city}, {b.state} {b.zip_code}</p>
      </div>
      <div className="space-y-1">
        <p className="font-medium text-slate-200">Building Info</p>
        <p className="text-slate-400">Code: {b.building_code ?? "—"}</p>
        <p className="text-slate-400">Roof Group: {b.roof_group ?? "—"}</p>
        <p className="text-slate-400">Sq Ft: {b.square_footage?.toLocaleString() ?? "—"}</p>
      </div>
      <div className="space-y-1">
        <p className="font-medium text-slate-200">Roof Access</p>
        <p className="text-slate-400">Type: {b.roof_access_type ?? "—"}</p>
        <p className="text-slate-400">Description: {b.roof_access_description ?? "—"}</p>
        <p className="text-slate-400">Location: {b.access_location ?? "—"}</p>
        <p className="text-slate-400">Lock/Gate: {b.lock_gate_codes ?? "—"}</p>
      </div>
      <div className="space-y-1">
        <p className="font-medium text-slate-200">Property Manager</p>
        <p className="text-slate-400">{b.property_manager_name ?? "—"}</p>
        <p className="text-slate-400">{b.property_manager_phone ? (
          <a href={`tel:${b.property_manager_phone}`} className="text-primary underline">{b.property_manager_phone}</a>
        ) : "—"}</p>
        <p className="text-slate-400">{b.property_manager_email ? (
          <a href={`mailto:${b.property_manager_email}`} className="text-primary underline">{b.property_manager_email}</a>
        ) : "—"}</p>
      </div>
      <div className="space-y-1">
        <p className="font-medium text-slate-200">Notes & Equipment</p>
        <p className="text-slate-400">Special Notes: {b.special_notes ?? "—"}</p>
        <p className="text-slate-400">Equipment: {b.special_equipment?.join(", ") ?? "—"}</p>
        <p className="text-slate-400">Inspector Notes: {row.inspector_notes ?? "—"}</p>
      </div>
      <div className="space-y-1">
        <p className="font-medium text-slate-200">Completion</p>
        <p className="text-slate-400">Date: {row.completion_date ? format(new Date(row.completion_date), "MMM d, yyyy") : "—"}</p>
        {row.photo_url && (
          <a href={row.photo_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
            View Photo
          </a>
        )}
      </div>
    </div>
  );
}
