import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import CMJobsBoard from "@/components/ops/CMJobsBoard";
import {
  Plus,
  Search,
  HardHat,
  Calendar,
  Loader2,
  FolderOpen,
} from "lucide-react";
import { format } from "date-fns";

type StatusFilter = "all" | "active" | "on_hold" | "complete";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: "active", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  on_hold: { label: "on hold", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  complete: { label: "complete", className: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
};

const PILLS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "complete", label: "Complete" },
];

export default function ConstructionManagement() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Fetch projects with building info
  const { data: projects, isLoading } = useQuery({
    queryKey: ["cm-projects-hub"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cm_projects")
        .select("*, buildings!inner(property_name, city, state)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch visit counts per project
  const { data: visitCounts } = useQuery({
    queryKey: ["cm-visit-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cm_visits")
        .select("cm_project_id, status");
      if (error) throw error;
      const counts: Record<string, { total: number; submitted: number }> = {};
      for (const v of data) {
        if (!counts[v.cm_project_id]) counts[v.cm_project_id] = { total: 0, submitted: 0 };
        counts[v.cm_project_id].total++;
        if (v.status === "submitted") counts[v.cm_project_id].submitted++;
      }
      return counts;
    },
  });

  const filtered = useMemo(() => {
    if (!projects) return [];
    return projects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const bld = p.buildings as any;
        const haystack = `${p.project_name} ${bld?.property_name ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [projects, statusFilter, search]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold">Construction Management</h1>

      <Tabs defaultValue="projects">
        <TabsList>
          <TabsTrigger value="projects">Active Projects</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Active Projects ─── */}
        <TabsContent value="projects" className="space-y-4 mt-4">
          {/* Filters row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-slate-900 border-slate-600"
              />
            </div>

            <div className="flex gap-1.5">
              {PILLS.map((pill) => (
                <Button
                  key={pill.value}
                  variant={statusFilter === pill.value ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setStatusFilter(pill.value)}
                >
                  {pill.label}
                </Button>
              ))}
            </div>

            <div className="sm:ml-auto">
              <Button size="sm" className="gap-1.5" onClick={() => navigate("/cm/new")}>
                <Plus className="h-3.5 w-3.5" />
                New Project
              </Button>
            </div>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {/* Empty */}
          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FolderOpen className="h-12 w-12 text-slate-500 opacity-20 mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                No active projects. Create your first project.
              </p>
              <Button size="sm" onClick={() => navigate("/cm/new")}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                New Project
              </Button>
            </div>
          )}

          {/* Cards grid */}
          {!isLoading && filtered.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filtered.map((project) => {
                const bld = project.buildings as any;
                const badge = STATUS_BADGE[project.status] ?? STATUS_BADGE.active;
                const vc = visitCounts?.[project.id];

                return (
                  <Card
                    key={project.id}
                    className="bg-slate-800 border-slate-700/50 hover:border-slate-600 transition-colors cursor-pointer"
                    onClick={() => navigate(`/cm/${project.id}`)}
                  >
                    <CardContent className="p-5 space-y-3">
                      {/* Row 1: name + badge */}
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-semibold text-slate-100 leading-tight">
                          {project.project_name}
                        </h3>
                        <Badge className={badge.className}>{badge.label}</Badge>
                      </div>

                      {/* Row 2: building */}
                      <p className="text-sm text-slate-400">
                        {bld?.property_name} · {bld?.city}, {bld?.state}
                      </p>

                      {/* Row 3: tags */}
                      <div className="flex flex-wrap gap-1.5">
                        {project.ri_number && (
                          <Badge variant="outline" className="text-[10px] font-medium border-slate-600 text-slate-300">
                            RI {project.ri_number}
                          </Badge>
                        )}
                        {project.membrane_type && (
                          <Badge variant="outline" className="text-[10px] font-medium border-slate-600 text-slate-300">
                            {project.membrane_type}
                          </Badge>
                        )}
                      </div>

                      {/* Row 4: contractor */}
                      {project.contractor_name && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <HardHat className="h-3.5 w-3.5" />
                          {project.contractor_name}
                        </div>
                      )}

                      {/* Row 5: dates */}
                      {(project.contract_start_date || project.contract_completion_date) && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Calendar className="h-3.5 w-3.5" />
                          {project.contract_start_date && (
                            <span>Start: {format(new Date(project.contract_start_date), "MMM d, yyyy")}</span>
                          )}
                          {project.contract_start_date && project.contract_completion_date && (
                            <span className="text-slate-600">·</span>
                          )}
                          {project.contract_completion_date && (
                            <span>End: {format(new Date(project.contract_completion_date), "MMM d, yyyy")}</span>
                          )}
                        </div>
                      )}

                      {/* Row 6: visits */}
                      <p className="text-xs text-slate-500">
                        {vc ? `${vc.total} visits · ${vc.submitted} submitted` : "0 visits"}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ─── Tab 2: Pipeline ─── */}
        <TabsContent value="pipeline" className="mt-4">
          <CMJobsBoard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
