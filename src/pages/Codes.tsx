import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Search } from "lucide-react";

interface CodeEntry {
  id: string;
  code: string;
  properties: string[];
  client_name: string;
  region_name: string;
}

interface FilterOption {
  id: string;
  name: string;
}

export function CodesContent() {
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

      // Extract unique numeric 4-8 digit codes, deduplicated across buildings
      const codeRegex = /\b\d{4,8}\b/g;
      // Key: "code|client|region" → { code, properties[], client, region }
      const codeMap = new Map<string, { code: string; properties: Set<string>; client_name: string; region_name: string }>();
      for (const b of buildings as any[]) {
        const allText = [b.lock_gate_codes, b.roof_access_description, b.access_location].filter(Boolean).join(" ");
        const matches = allText.match(codeRegex);
        if (!matches) continue;
        const client = b.clients?.name ?? "Unknown";
        const region = b.regions?.name ?? "Unknown";
        for (const code of new Set(matches)) {
          const key = `${code}|${client}|${region}`;
          if (!codeMap.has(key)) {
            codeMap.set(key, { code, properties: new Set(), client_name: client, region_name: region });
          }
          codeMap.get(key)!.properties.add(b.property_name);
        }
      }
      const mapped: CodeEntry[] = [...codeMap.entries()].map(([key, v]) => ({
        id: key,
        code: v.code,
        properties: [...v.properties],
        client_name: v.client_name,
        region_name: v.region_name,
      })).sort((a, b) => b.properties.length - a.properties.length);

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
          e.properties.some(p => p.toLowerCase().includes(q)) ||
          e.code.includes(q)
      );
    }

    setFiltered(result);
  }, [entries, selectedClient, selectedRegion, search]);

  return (
    <div className="space-y-6">
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
        {filtered.length} {filtered.length === 1 ? "code" : "codes"} found
      </p>

      {/* Results */}
      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <KeyRound className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No lockbox codes found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-card border border-border">
              <code className="text-lg font-mono font-bold text-primary tracking-wider">{entry.code}</code>
              <span className="text-sm text-muted-foreground truncate">{entry.properties.length} {entry.properties.length === 1 ? "property" : "properties"}</span>
              <div className="ml-auto flex gap-1.5 shrink-0">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{entry.client_name}</Badge>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{entry.region_name}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Codes() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Lockbox Codes</h1>
        <p className="text-muted-foreground mt-1">
          Quick reference for lockbox codes by client and region
        </p>
      </div>
      <CodesContent />
    </div>
  );
}