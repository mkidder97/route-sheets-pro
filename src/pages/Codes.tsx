import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Search, Building2 } from "lucide-react";

interface CodeEntry {
  id: string;
  property_name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  lock_gate_codes: string | null;
  access_location: string | null;
  roof_access_description: string | null;
  roof_access_type: string | null;
  client_name: string;
  region_name: string;
}

interface FilterOption {
  id: string;
  name: string;
}

export default function Codes() {
  const [entries, setEntries] = useState<CodeEntry[]>([]);
  const [filtered, setFiltered] = useState<CodeEntry[]>([]);
  const [clients, setClients] = useState<FilterOption[]>([]);
  const [regions, setRegions] = useState<FilterOption[]>([]);
  const [selectedClient, setSelectedClient] = useState("all");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: buildings } = await supabase
        .from("buildings")
        .select("id, property_name, address, city, state, zip_code, lock_gate_codes, access_location, roof_access_description, roof_access_type, clients(name), regions(name)")
        .order("property_name");

      if (!buildings) { setLoading(false); return; }

      const mapped: CodeEntry[] = buildings
        .filter((b: any) => b.lock_gate_codes || b.access_location || b.roof_access_description)
        .map((b: any) => ({
          id: b.id,
          property_name: b.property_name,
          address: b.address,
          city: b.city,
          state: b.state,
          zip_code: b.zip_code,
          lock_gate_codes: b.lock_gate_codes,
          access_location: b.access_location,
          roof_access_description: b.roof_access_description,
          roof_access_type: b.roof_access_type,
          client_name: b.clients?.name ?? "Unknown",
          region_name: b.regions?.name ?? "Unknown",
        }));

      setEntries(mapped);
      setFiltered(mapped);

      // Extract unique clients and regions
      const clientMap = new Map<string, string>();
      const regionMap = new Map<string, string>();
      for (const e of mapped) {
        if (!clientMap.has(e.client_name)) clientMap.set(e.client_name, e.client_name);
        if (!regionMap.has(e.region_name)) regionMap.set(e.region_name, e.region_name);
      }
      setClients([...clientMap.entries()].map(([id, name]) => ({ id, name })));
      setRegions([...regionMap.entries()].map(([id, name]) => ({ id, name })));
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    let result = entries;

    if (selectedClient !== "all") {
      result = result.filter((e) => e.client_name === selectedClient);
    }
    if (selectedRegion !== "all") {
      result = result.filter((e) => e.region_name === selectedRegion);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.property_name.toLowerCase().includes(q) ||
          e.address.toLowerCase().includes(q) ||
          e.city.toLowerCase().includes(q) ||
          (e.lock_gate_codes ?? "").toLowerCase().includes(q) ||
          (e.access_location ?? "").toLowerCase().includes(q) ||
          (e.roof_access_description ?? "").toLowerCase().includes(q)
      );
    }

    setFiltered(result);
  }, [entries, selectedClient, selectedRegion, search]);

  const accessLabel: Record<string, string> = {
    roof_hatch: "Hatch",
    exterior_ladder: "Ext. Ladder",
    interior_ladder: "Int. Ladder",
    ground_level: "Ground",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Codes & Access</h1>
        <p className="text-muted-foreground mt-1">
          Quick reference for gate codes, lock codes, and access instructions by property
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search properties, codes, descriptions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedRegion} onValueChange={setSelectedRegion}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Regions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            {regions.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "property" : "properties"} with access info
      </p>

      {/* Results */}
      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <KeyRound className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No access codes or instructions found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((entry) => (
            <Card key={entry.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{entry.property_name}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {entry.client_name}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {entry.region_name}
                      </Badge>
                      {entry.roof_access_type && entry.roof_access_type !== "other" && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {accessLabel[entry.roof_access_type] ?? entry.roof_access_type}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {entry.address}, {entry.city}, {entry.state} {entry.zip_code}
                    </p>

                    <div className="flex flex-col gap-1 mt-2">
                      {entry.lock_gate_codes && (
                        <div className="flex items-start gap-2 text-sm">
                          <KeyRound className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                          <span><span className="font-medium">Codes:</span> {entry.lock_gate_codes}</span>
                        </div>
                      )}
                      {entry.access_location && (
                        <div className="flex items-start gap-2 text-sm">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <span><span className="font-medium">Access:</span> {entry.access_location}</span>
                        </div>
                      )}
                      {entry.roof_access_description && (
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="ml-5.5">{entry.roof_access_description}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
