import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ArrowLeft, Star, Bell, UserRound, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
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

const BUILDING_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "complete", label: "Complete" },
  { value: "skipped", label: "Skipped" },
  { value: "needs_revisit", label: "Needs Revisit" },
];

const BUILDING_STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  complete: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  skipped: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  needs_revisit: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

const CAMPAIGN_STATUS_OPTIONS = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "complete", label: "Complete" },
  { value: "on_hold", label: "On Hold" },
];

const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  planning: "bg-muted text-muted-foreground",
  active: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  complete: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  on_hold: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

const TYPE_BADGE_COLORS: Record<string, string> = {
  annual: "border-blue-500 text-blue-700 dark:text-blue-300",
  due_diligence: "border-purple-500 text-purple-700 dark:text-purple-300",
  survey: "border-teal-500 text-teal-700 dark:text-teal-300",
  storm: "border-red-500 text-red-700 dark:text-red-300",
};

const INSPECTION_TYPE_LABELS: Record<string, string> = {
  annual: "Annual",
  due_diligence: "Due Diligence",
  survey: "Survey",
  storm: "Storm",
};

type SortKey = "stop_number" | "property_name" | "city" | "inspection_status" | "scheduled_week";

const BUILDING_LEVEL_SORT_KEYS = new Set(["stop_number", "property_name", "city"]);

export default function OpsCampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const canEdit = role === "admin" || role === "office_manager";

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [buildings, setBuildings] = useState<CampaignBuilding[]>([]);
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterInspector, setFilterInspector] = useState("all");
  const [search, setSearch] = useState("");
  const [priorityOnly, setPriorityOnly] = useState(false);

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("stop_number");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    if (id) {
      fetchCampaign();
      fetchInspectors();
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

  async function updateCampaignStatus(newStatus: string) {
    if (!campaign) return;
    const { error } = await supabase
      .from("inspection_campaigns")
      .update({ status: newStatus })
      .eq("id", campaign.id);
    if (error) {
      toast.error("Failed to update status");
    } else {
      setCampaign({ ...campaign, status: newStatus });
      toast.success("Status updated");
    }
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
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

  if (!campaign) {
    return <p className="text-sm text-muted-foreground p-4">Loading…</p>;
  }

  const pct = campaign.total_buildings > 0
    ? Math.round((campaign.completed_buildings / campaign.total_buildings) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/ops/jobs")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Job Board
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold">{campaign.name}</h1>
            <p className="text-sm text-muted-foreground">
              {campaign.clients?.name} — {campaign.regions?.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(campaign.start_date), "MMM d, yyyy")} –{" "}
              {format(new Date(campaign.end_date), "MMM d, yyyy")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={TYPE_BADGE_COLORS[campaign.inspection_type] ?? ""}>
              {INSPECTION_TYPE_LABELS[campaign.inspection_type] ?? campaign.inspection_type}
            </Badge>
            {canEdit ? (
              <Select value={campaign.status} onValueChange={updateCampaignStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="secondary" className={CAMPAIGN_STATUS_COLORS[campaign.status] ?? ""}>
                {CAMPAIGN_STATUS_OPTIONS.find((s) => s.value === campaign.status)?.label ?? campaign.status}
              </Badge>
            )}
          </div>
        </div>
        <div className="space-y-1 max-w-md">
          <Progress value={pct} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {campaign.completed_buildings} of {campaign.total_buildings} buildings complete ({pct}%)
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]">
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
          <SelectTrigger className="w-[180px]">
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
          className="w-[220px]"
        />

        <div className="flex items-center gap-2">
          <Switch checked={priorityOnly} onCheckedChange={setPriorityOnly} id="priority-toggle" />
          <Label htmlFor="priority-toggle" className="text-sm">Priority Only</Label>
        </div>
      </div>

      {/* Buildings Table */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading buildings…</p>
      ) : filtered.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">No buildings match the current filters.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <SortableHead label="Stop #" sortKey="stop_number" current={sortKey} asc={sortAsc} onSort={handleSort} />
              <SortableHead label="Property Name" sortKey="property_name" current={sortKey} asc={sortAsc} onSort={handleSort} />
              <SortableHead label="Address" sortKey="city" current={sortKey} asc={sortAsc} onSort={handleSort} />
              <SortableHead label="Status" sortKey="inspection_status" current={sortKey} asc={sortAsc} onSort={handleSort} />
              <TableHead>Inspector</TableHead>
              <SortableHead label="Week" sortKey="scheduled_week" current={sortKey} asc={sortAsc} onSort={handleSort} />
              <TableHead>Flags</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((b) => (
              <Collapsible key={b.id} open={expandedId === b.id} onOpenChange={(open) => setExpandedId(open ? b.id : null)} asChild>
                <>
                  <CollapsibleTrigger asChild>
                    <TableRow className="cursor-pointer">
                      <TableCell className="w-8">
                        {expandedId === b.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </TableCell>
                      <TableCell>{b.building.stop_number ?? "—"}</TableCell>
                      <TableCell className="font-medium">{b.building.property_name}</TableCell>
                      <TableCell>{b.building.city}, {b.building.state}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={BUILDING_STATUS_COLORS[b.inspection_status] ?? ""}>
                          {BUILDING_STATUS_OPTIONS.find((s) => s.value === b.inspection_status)?.label ?? b.inspection_status}
                        </Badge>
                      </TableCell>
                      <TableCell>{b.inspector?.name ?? "—"}</TableCell>
                      <TableCell>{b.scheduled_week ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {b.is_priority && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                          {b.building.requires_advance_notice && <Bell className="h-4 w-4 text-muted-foreground" />}
                          {b.building.requires_escort && <UserRound className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </TableCell>
                    </TableRow>
                  </CollapsibleTrigger>
                  <CollapsibleContent asChild>
                    <tr>
                      <td colSpan={8} className="bg-muted/30 p-4">
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
      className="cursor-pointer select-none"
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
        <p className="font-medium">Address</p>
        <p>{b.address}</p>
        <p>{b.city}, {b.state} {b.zip_code}</p>
      </div>
      <div className="space-y-1">
        <p className="font-medium">Building Info</p>
        <p>Code: {b.building_code ?? "—"}</p>
        <p>Roof Group: {b.roof_group ?? "—"}</p>
        <p>Sq Ft: {b.square_footage?.toLocaleString() ?? "—"}</p>
      </div>
      <div className="space-y-1">
        <p className="font-medium">Roof Access</p>
        <p>Type: {b.roof_access_type ?? "—"}</p>
        <p>Description: {b.roof_access_description ?? "—"}</p>
        <p>Location: {b.access_location ?? "—"}</p>
        <p>Lock/Gate: {b.lock_gate_codes ?? "—"}</p>
      </div>
      <div className="space-y-1">
        <p className="font-medium">Property Manager</p>
        <p>{b.property_manager_name ?? "—"}</p>
        <p>{b.property_manager_phone ?? "—"}</p>
        <p>{b.property_manager_email ?? "—"}</p>
      </div>
      <div className="space-y-1">
        <p className="font-medium">Notes & Equipment</p>
        <p>Special Notes: {b.special_notes ?? "—"}</p>
        <p>Equipment: {b.special_equipment?.join(", ") ?? "—"}</p>
        <p>Inspector Notes: {row.inspector_notes ?? "—"}</p>
      </div>
      <div className="space-y-1">
        <p className="font-medium">Completion</p>
        <p>Date: {row.completion_date ? format(new Date(row.completion_date), "MMM d, yyyy") : "—"}</p>
        {row.photo_url && (
          <a href={row.photo_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
            View Photo
          </a>
        )}
      </div>
    </div>
  );
}
