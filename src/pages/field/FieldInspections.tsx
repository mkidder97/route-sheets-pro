import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import FieldTodayView from "@/components/FieldTodayView";
import { CodesContent } from "@/pages/Codes";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Building2, ClipboardCheck, History, Route, Loader2, ChevronDown, ChevronUp, Phone, Mail, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function FieldInspections() {
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");

  // Filter options — clients & regions
  const { data: filterOptions } = useQuery({
    queryKey: ["field-filter-options"],
    queryFn: async () => {
      const [clientsRes, regionsRes] = await Promise.all([
        supabase.from("clients").select("id, name").eq("is_active", true).order("name"),
        supabase.from("regions").select("id, name, client_id").order("name"),
      ]);
      return {
        clients: clientsRes.data ?? [],
        regions: regionsRes.data ?? [],
      };
    },
  });

  // Campaign query
  const { data: campaign, isLoading: campaignLoading } = useQuery({
    queryKey: ["field-campaign", profile?.inspector_id],
    enabled: !!profile?.inspector_id,
    queryFn: async () => {
      const { data: insp } = await supabase
        .from("inspectors")
        .select("region_id")
        .eq("id", profile!.inspector_id!)
        .single();
      if (!insp?.region_id) return null;
      const { data } = await supabase
        .from("inspection_campaigns")
        .select("id, name, total_buildings, completed_buildings, start_date, end_date, inspection_type")
        .eq("region_id", insp.region_id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
  });

  // Buildings query
  const buildingsEnabled = selectedClient !== "" || selectedRegion !== "" || search.trim().length >= 2;
  const { data: buildings, isLoading: buildingsLoading } = useQuery({
    queryKey: ["field-buildings-search", selectedClient, selectedRegion, search],
    enabled: buildingsEnabled,
    queryFn: async () => {
      let q = supabase
        .from("buildings")
        .select("id, property_name, address, city, state, roof_access_type, lock_gate_codes, special_notes")
        .order("property_name")
        .limit(200);
      if (selectedClient) q = q.eq("client_id", selectedClient);
      if (selectedRegion) q = q.eq("region_id", selectedRegion);
      if (search.trim().length >= 2) {
        q = q.or(`property_name.ilike.%${search.trim()}%,address.ilike.%${search.trim()}%`);
      }
      const { data } = await q;
      return data ?? [];
    },
  });

  // History query
  const { data: historyItems, isLoading: historyLoading } = useQuery({
    queryKey: ["field-history", profile?.inspector_id],
    enabled: !!profile?.inspector_id,
    queryFn: async () => {
      const { data: insp } = await supabase
        .from("inspectors")
        .select("region_id")
        .eq("id", profile!.inspector_id!)
        .single();
      if (!insp?.region_id) return [];

      const { data: campaigns } = await supabase
        .from("inspection_campaigns")
        .select("id, name")
        .eq("region_id", insp.region_id);
      if (!campaigns?.length) return [];

      const campaignIds = campaigns.map((c) => c.id);
      const campaignMap = Object.fromEntries(campaigns.map((c) => [c.id, c.name]));

      const { data: completed } = await supabase
        .from("campaign_buildings")
        .select("campaign_id, completed_at, buildings(property_name, address, city)")
        .in("campaign_id", campaignIds)
        .eq("inspection_status", "complete")
        .order("completed_at", { ascending: false })
        .limit(100);

      return (completed ?? []).map((row: any) => ({
        building_name: row.buildings?.property_name ?? "Unknown",
        address: row.buildings?.address ?? "",
        city: row.buildings?.city ?? "",
        campaign_name: campaignMap[row.campaign_id] ?? "",
        completed_at: row.completed_at,
      }));
    },
  });

  const filteredRegions = selectedClient
    ? (filterOptions?.regions ?? []).filter((r) => r.client_id === selectedClient)
    : (filterOptions?.regions ?? []);

  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="route" className="flex flex-1 flex-col">
        <TabsList className="w-full shrink-0 bg-slate-800 border-b border-slate-700/50">
          <TabsTrigger value="route" className="flex-1 text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100">Route</TabsTrigger>
          <TabsTrigger value="campaign" className="flex-1 text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100">Campaign</TabsTrigger>
          <TabsTrigger value="buildings" className="flex-1 text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100">Buildings</TabsTrigger>
          <TabsTrigger value="codes" className="flex-1 text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100">Codes</TabsTrigger>
          <TabsTrigger value="history" className="flex-1 text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100">History</TabsTrigger>
        </TabsList>

        {/* Tab 1 — Route */}
        <TabsContent value="route" className="flex-1 overflow-y-auto">
          {profile?.inspector_id ? (
            <FieldTodayView inspectorId={profile.inspector_id} />
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
              <Route className="h-12 w-12 opacity-20" />
              <p className="mt-3 text-sm">No route assigned</p>
              <p className="mt-1 text-xs text-slate-600">Ask your office manager to link your inspector profile</p>
            </div>
          )}
        </TabsContent>

        {/* Tab 2 — Campaign */}
        <TabsContent value="campaign" className="flex-1 overflow-y-auto space-y-4 p-1">
          {!profile?.inspector_id ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
              <ClipboardCheck className="h-12 w-12 opacity-20" />
              <p className="mt-3 text-sm">No inspector profile linked</p>
            </div>
          ) : campaignLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !campaign ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
              <ClipboardCheck className="h-12 w-12 opacity-20" />
              <p className="mt-3 text-sm">No active campaign</p>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-100">{campaign.name}</h3>
                <Badge variant="secondary" className="text-[10px]">{campaign.inspection_type}</Badge>
              </div>
              <p className="text-xs text-slate-400">
                {format(new Date(campaign.start_date), "MMM d, yyyy")} — {format(new Date(campaign.end_date), "MMM d, yyyy")}
              </p>
            </div>
          )}
        </TabsContent>

        {/* Tab 3 — Buildings */}
        <TabsContent value="buildings" className="flex-1 overflow-y-auto space-y-4 p-1">
          <div className="flex gap-2">
            <Select value={selectedClient} onValueChange={(v) => { setSelectedClient(v === "__all__" ? "" : v); setSelectedRegion(""); }}>
              <SelectTrigger className="w-full bg-slate-800 border-slate-700 text-slate-100 text-xs">
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Clients</SelectItem>
                {filterOptions?.clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedRegion} onValueChange={(v) => setSelectedRegion(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-full bg-slate-800 border-slate-700 text-slate-100 text-xs">
                <SelectValue placeholder="All Regions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Regions</SelectItem>
                {filteredRegions.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search name or address…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
            />
          </div>
          {!buildingsEnabled ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Building2 className="h-10 w-10 opacity-20" />
              <p className="mt-3 text-sm">Select a client or region, or search by name</p>
            </div>
          ) : buildingsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : buildings && buildings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Building2 className="h-10 w-10 opacity-20" />
              <p className="mt-3 text-sm">No buildings found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {buildings?.map((b) => (
                <div key={b.id} className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-100 text-sm truncate">{b.property_name}</span>
                    {b.roof_access_type && (
                      <Badge variant="outline" className="text-[10px] shrink-0">{b.roof_access_type}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">{b.address}, {b.city}, {b.state}</p>
                  {b.lock_gate_codes && (
                    <code className="block text-xs font-mono text-primary tracking-wider">{b.lock_gate_codes}</code>
                  )}
                  {b.special_notes && (
                    <p className="text-xs italic text-slate-500">{b.special_notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 4 — Codes */}
        <TabsContent value="codes" className="flex-1 overflow-y-auto p-1">
          <CodesContent />
        </TabsContent>

        {/* Tab 5 — History */}
        <TabsContent value="history" className="flex-1 overflow-y-auto space-y-4 p-1">
          {!profile?.inspector_id ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
              <History className="h-12 w-12 opacity-20" />
              <p className="mt-3 text-sm">No inspector profile linked</p>
            </div>
          ) : historyLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !historyItems?.length ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
              <History className="h-12 w-12 opacity-20" />
              <p className="mt-3 text-sm">No completed inspections yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {historyItems.map((item, i) => (
                <div key={i} className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-100 text-sm truncate">{item.building_name}</span>
                    {item.campaign_name && (
                      <Badge variant="secondary" className="text-[10px] shrink-0">{item.campaign_name}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">{item.address}, {item.city}</p>
                  {item.completed_at && (
                    <p className="text-xs text-slate-500">{format(new Date(item.completed_at), "MMM d, yyyy")}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
