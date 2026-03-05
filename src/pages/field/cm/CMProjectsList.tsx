import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Search, Building2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

export default function CMProjectsList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { user } = useAuth();

  const { data: projects, isLoading } = useQuery({
    queryKey: ["field-cm-projects", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // Get project IDs where this inspector has at least one visit
      const { data: assignedVisits } = await supabase
        .from("cm_visits")
        .select("cm_project_id")
        .eq("inspector_id", user!.id);

      const projectIds = [...new Set(assignedVisits?.map((v) => v.cm_project_id) ?? [])];
      if (projectIds.length === 0) return [];

      const { data, error } = await supabase
        .from("cm_projects")
        .select("id, project_name, membrane_type, status, building_id, buildings(property_name, address, city, state)")
        .in("id", projectIds)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch visit counts per project
      const { data: visits } = await supabase
        .from("cm_visits")
        .select("id, cm_project_id, status")
        .in("cm_project_id", projectIds);

      const visitMap: Record<string, { total: number; submitted: number }> = {};
      (visits ?? []).forEach((v: any) => {
        if (!visitMap[v.cm_project_id]) visitMap[v.cm_project_id] = { total: 0, submitted: 0 };
        visitMap[v.cm_project_id].total++;
        if (v.status === "submitted") visitMap[v.cm_project_id].submitted++;
      });

      return (data ?? []).map((p: any) => ({
        ...p,
        visitCounts: visitMap[p.id] || { total: 0, submitted: 0 },
      }));
    },
  });

  const filtered = (projects ?? []).filter((p: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const building = p.buildings as any;
    return (
      p.project_name?.toLowerCase().includes(q) ||
      building?.property_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-100">CM Jobs</h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects or buildings..."
          className="border-slate-700 bg-slate-800 pl-9 text-slate-100 placeholder:text-slate-500"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
        </div>
      ) : !filtered.length ? (
        <div className="flex flex-col items-center py-12 text-slate-500">
          <Building2 className="h-12 w-12 opacity-20" />
          <p className="mt-3 text-sm">No projects assigned to you yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p: any) => {
            const building = p.buildings as any;
            return (
              <button
                key={p.id}
                onClick={() => navigate(`/field/cm/${p.id}`)}
                className="w-full rounded-xl border border-slate-700/50 bg-slate-800 p-4 text-left transition-colors hover:bg-slate-700/60"
              >
                <div className="flex items-start justify-between">
                  <p className="text-sm font-semibold text-slate-100">{p.project_name}</p>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px]">
                    {p.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-slate-400">{building?.property_name}</p>
                <p className="text-xs text-slate-500">
                  {[building?.address, building?.city, building?.state].filter(Boolean).join(", ")}
                </p>
                <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                  {p.membrane_type && <span>{p.membrane_type}</span>}
                  <span>
                    {p.visitCounts.submitted} of {p.visitCounts.total} visits submitted
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

    </div>
  );
}
