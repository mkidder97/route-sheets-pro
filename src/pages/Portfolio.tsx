import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Building2,
  Ruler,
  ClipboardCheck,
  AlertTriangle,
  ChevronRight,
  Loader2,
  Search,
} from "lucide-react";
import { format } from "date-fns";

interface BuildingRow {
  id: string;
  property_name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  square_footage: number | null;
  inspection_status: string;
  is_priority: boolean | null;
  is_deleted: boolean | null;
  client_id: string;
  clients: { name: string } | null;
  regions: { name: string } | null;
  inspectors: { name: string } | null;
}

interface ClientRow {
  id: string;
  name: string;
}

interface CampaignRow {
  id: string;
  name: string;
  status: string;
  client_id: string;
  completed_buildings: number;
  total_buildings: number;
  end_date: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "pending", className: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
  in_progress: { label: "in progress", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  complete: { label: "complete", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  completed: { label: "completed", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  skipped: { label: "skipped", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  needs_revisit: { label: "needs revisit", className: "bg-red-500/20 text-red-400 border-red-500/30" },
  active: { label: "active", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
};

function formatSqFt(total: number): string {
  if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(1)} M sq ft`;
  return `${total.toLocaleString()} sq ft`;
}

export default function Portfolio() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [selectedClient, setSelectedClient] = useState<string>(
    searchParams.get("client") || ""
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [bRes, cRes, campRes] = await Promise.all([
        supabase
          .from("buildings")
          .select(
            "id, property_name, address, city, state, zip_code, square_footage, inspection_status, is_priority, is_deleted, client_id, clients(name), regions(name), inspectors(name)"
          )
          .or("is_deleted.is.null,is_deleted.eq.false")
          .order("property_name"),
        supabase
          .from("clients")
          .select("id, name")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("inspection_campaigns")
          .select("id, name, status, client_id, completed_buildings, total_buildings, end_date")
          .neq("status", "completed"),
      ]);
      if (bRes.data) setBuildings(bRes.data as BuildingRow[]);
      if (cRes.data) setClients(cRes.data);
      if (campRes.data) setCampaigns(campRes.data);
      setLoading(false);
    }
    fetchData();
  }, []);

  const handleClientChange = (value: string) => {
    if (value === "all") {
      setSelectedClient("");
      navigate("/portfolio", { replace: true });
    } else {
      setSelectedClient(value);
      navigate(`/portfolio?client=${value}`, { replace: true });
    }
  };

  const filteredBuildings = useMemo(() => {
    let list = buildings;
    if (selectedClient) list = list.filter((b) => b.client_id === selectedClient);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (b) =>
          b.property_name.toLowerCase().includes(q) ||
          b.address.toLowerCase().includes(q) ||
          b.city.toLowerCase().includes(q) ||
          b.zip_code.toLowerCase().includes(q)
      );
    }
    return list;
  }, [buildings, selectedClient, search]);

  const clientCampaigns = useMemo(
    () => (selectedClient ? campaigns.filter((c) => c.client_id === selectedClient) : []),
    [campaigns, selectedClient]
  );

  // KPI calculations
  const totalBuildings = filteredBuildings.length;
  const totalSqFt = filteredBuildings.reduce((s, b) => s + (b.square_footage || 0), 0);
  const completedCount = filteredBuildings.filter(
    (b) => b.inspection_status === "complete" || b.inspection_status === "completed"
  ).length;
  const completionPct = totalBuildings > 0 ? Math.round((completedCount / totalBuildings) * 100) : 0;
  const priorityCount = filteredBuildings.filter((b) => b.is_priority).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Portfolio</h1>
          <p className="text-sm text-slate-400 mt-0.5">Client portfolio overview</p>
        </div>
        <Select value={selectedClient || "all"} onValueChange={handleClientChange}>
          <SelectTrigger className="w-64 bg-slate-900 border-slate-600 text-slate-100">
            <SelectValue placeholder="All Clients" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      {selectedClient && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Buildings */}
          <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Total Buildings
            </p>
            <p className="text-4xl font-bold text-white leading-none mt-1">{totalBuildings}</p>
          </div>

          {/* Total Sq Footage */}
          <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-violet-500/15 flex items-center justify-center">
                <Ruler className="w-5 h-5 text-violet-400" />
              </div>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Total Sq Footage
            </p>
            <p className="text-4xl font-bold text-white leading-none mt-1">
              {formatSqFt(totalSqFt)}
            </p>
          </div>

          {/* Inspection Completion */}
          <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <ClipboardCheck className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Inspection Completion
            </p>
            <p className="text-4xl font-bold text-white leading-none mt-1">{completionPct}%</p>
            <Progress value={completionPct} className="h-1.5 mt-2 bg-slate-700" />
            <p className="text-xs text-slate-500 mt-1">
              {completedCount} of {totalBuildings} complete
            </p>
          </div>

          {/* Priority Buildings */}
          <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Priority Buildings
            </p>
            <p
              className={`text-4xl font-bold leading-none mt-1 ${
                priorityCount > 0 ? "text-amber-400" : "text-white"
              }`}
            >
              {priorityCount}
            </p>
          </div>
        </div>
      )}

      {/* Building Table */}
      <div className="rounded-xl bg-slate-800 border border-slate-700/50">
        <div className="p-4 border-b border-slate-700/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search buildings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-600 text-slate-100 placeholder:text-slate-500"
            />
          </div>
        </div>
        {filteredBuildings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Building2 className="w-12 h-12 opacity-20 mb-3" />
            <p className="text-sm">No buildings match your filters</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700/50 hover:bg-transparent">
                <TableHead className="text-xs uppercase tracking-wider text-slate-400">
                  Property Name
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-slate-400">
                  Address
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-slate-400">
                  City
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-slate-400">
                  State
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-slate-400">
                  Status
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-slate-400">
                  Priority
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-slate-400 text-right">
                  Sq Ft
                </TableHead>
                {!selectedClient && (
                  <TableHead className="text-xs uppercase tracking-wider text-slate-400">
                    Client
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBuildings.map((b) => {
                const sc = statusConfig[b.inspection_status] || statusConfig.pending;
                return (
                  <TableRow
                    key={b.id}
                    className="border-slate-700/50 cursor-pointer hover:bg-slate-700/50"
                    onClick={() => navigate(`/buildings/${b.id}`)}
                  >
                    <TableCell className="font-medium text-slate-100">{b.property_name}</TableCell>
                    <TableCell className="text-slate-300">{b.address}</TableCell>
                    <TableCell className="text-slate-300">{b.city}</TableCell>
                    <TableCell className="text-slate-300">{b.state}</TableCell>
                    <TableCell>
                      <Badge className={`${sc.className} text-xs font-medium lowercase`}>
                        {sc.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {b.is_priority && (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs font-medium">
                          P
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-slate-300">
                      {b.square_footage?.toLocaleString() ?? "—"}
                    </TableCell>
                    {!selectedClient && (
                      <TableCell className="text-slate-400">
                        {b.clients?.name ?? "—"}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Active Campaigns */}
      {selectedClient && clientCampaigns.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Active Campaigns</h2>
            <button
              onClick={() => navigate("/inspections/campaigns")}
              className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              View all <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid gap-3">
            {clientCampaigns.map((c) => {
              const pct =
                c.total_buildings > 0
                  ? Math.round((c.completed_buildings / c.total_buildings) * 100)
                  : 0;
              const sc = statusConfig[c.status] || statusConfig.active;
              return (
                <div
                  key={c.id}
                  className="rounded-xl bg-slate-800 border border-slate-700/50 p-4 cursor-pointer hover:bg-slate-700/50 transition-colors"
                  onClick={() => navigate(`/inspections/campaigns/${c.id}`)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-slate-100">{c.name}</span>
                    <Badge className={`${sc.className} text-xs font-medium lowercase`}>
                      {sc.label}
                    </Badge>
                  </div>
                  <Progress value={pct} className="h-1.5 bg-slate-700" />
                  <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                    <span>
                      {c.completed_buildings}/{c.total_buildings} ({pct}%)
                    </span>
                    <span>Ends {format(new Date(c.end_date), "MMM d, yyyy")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
