import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible, CollapsibleTrigger, CollapsibleContent,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Search, Loader2, Users, Mail, Phone, ChevronDown, Building2 } from "lucide-react";

interface PMContact {
  email: string;
  name: string;
  phone: string | null;
  clientName: string | null;
  clientId: string | null;
  buildings: string[];
}

interface ClientOption {
  id: string;
  name: string;
}

export default function Contacts() {
  const [contacts, setContacts] = useState<PMContact[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("all");

  const fetchData = async () => {
    setLoading(true);
    const [buildingsRes, clientsRes] = await Promise.all([
      supabase
        .from("buildings")
        .select("id, property_name, property_manager_name, property_manager_email, property_manager_phone, client_id, clients(name)")
        .not("property_manager_email", "is", null)
        .order("property_manager_name"),
      supabase.from("clients").select("id, name").eq("is_active", true).order("name"),
    ]);

    if (buildingsRes.error) {
      toast.error("Failed to load contacts");
    } else {
      const grouped = new Map<string, PMContact>();
      for (const b of buildingsRes.data ?? []) {
        const email = (b.property_manager_email as string).toLowerCase();
        const existing = grouped.get(email);
        const clientData = b.clients as { name: string } | null;
        if (existing) {
          existing.buildings.push(b.property_name);
          if (!existing.name && b.property_manager_name) existing.name = b.property_manager_name;
          if (!existing.phone && b.property_manager_phone) existing.phone = b.property_manager_phone;
          if (!existing.clientName && clientData?.name) {
            existing.clientName = clientData.name;
            existing.clientId = b.client_id;
          }
        } else {
          grouped.set(email, {
            email: b.property_manager_email as string,
            name: b.property_manager_name ?? "",
            phone: b.property_manager_phone ?? null,
            clientName: clientData?.name ?? null,
            clientId: b.client_id,
            buildings: [b.property_name],
          });
        }
      }
      setContacts(Array.from(grouped.values()));
    }

    if (!clientsRes.error) setClients((clientsRes.data as ClientOption[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
    const matchesClient = clientFilter === "all" || c.clientId === clientFilter;
    return matchesSearch && matchesClient;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Contacts</h1>
        <span className="text-sm text-slate-400">{filtered.length} contacts</span>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input placeholder="Search name or email…" className="pl-9 bg-slate-900 border-slate-600" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-[180px] bg-slate-900 border-slate-600">
            <SelectValue placeholder="All Clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
          <Users className="h-10 w-10 opacity-20" />
          <p>No contacts found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((c) => (
            <Card key={c.email} className="bg-slate-800 border-slate-700/50 rounded-xl">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <p className="text-slate-100 font-semibold text-sm">{c.name || "—"}</p>
                  {c.clientName && (
                    <Badge variant="secondary" className="text-xs bg-slate-700 text-slate-300 border-0">
                      {c.clientName}
                    </Badge>
                  )}
                </div>

                <div className="space-y-1.5">
                  <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    {c.email}
                  </a>
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-sm text-slate-300 hover:text-slate-100 transition-colors">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      {c.phone}
                    </a>
                  )}
                </div>

                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors group">
                    <Building2 className="h-3.5 w-3.5" />
                    {c.buildings.length} building{c.buildings.length !== 1 ? "s" : ""}
                    <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 pl-5 space-y-0.5">
                    {c.buildings.map((name, i) => (
                      <p key={i} className="text-xs text-slate-400">{name}</p>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
