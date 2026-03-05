import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { HardHat, Lock, Calendar, Loader2, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";


function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function FieldHome() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["field-assignments", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cm_visits")
        .select("id, visit_number, visit_date, status, cm_project_id, cm_projects(id, project_name, building_id, buildings(property_name))")
        .eq("inspector_id", user!.id)
        .eq("status", "draft")
        .order("visit_date");
      if (error) throw error;
      return data;
    },
  });

  const { data: campaign } = useQuery({
    queryKey: ["field-campaign-banner", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: prof } = await supabase
        .from("user_profiles").select("inspector_id").eq("id", user!.id).single();
      if (!prof?.inspector_id) return null;
      const { data: insp } = await supabase
        .from("inspectors").select("region_id").eq("id", prof.inspector_id).single();
      if (!insp?.region_id) return null;
      const { data } = await supabase
        .from("inspection_campaigns")
        .select("id, name, total_buildings, completed_buildings, start_date, end_date")
        .eq("region_id", insp.region_id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
  });

  const comingSoon = [
    { title: "Annual Inspections", desc: "Routine roof assessments" },
    { title: "Storm Inspections", desc: "Post-event damage surveys" },
    { title: "Due Diligence", desc: "Pre-acquisition evaluations" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">
        {getGreeting()}, {firstName}
      </h1>

      {campaign && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15">
              <ClipboardCheck className="h-4 w-4 text-blue-400" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Active Campaign
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-100">{campaign.name}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {format(new Date(campaign.start_date), "MMM d")} – {format(new Date(campaign.end_date), "MMM d, yyyy")}
          </p>
        </div>
      )}

      {/* Assignments */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Your Assignments
        </h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          </div>
        ) : !assignments?.length ? (
          <div className="flex flex-col items-center py-12 text-slate-500">
            <HardHat className="h-12 w-12 opacity-20" />
            <p className="mt-3 text-sm">No assignments yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {assignments.map((v: any) => {
              const project = v.cm_projects as any;
              const building = project?.buildings as any;
              return (
                <button
                  key={v.id}
                  onClick={() => navigate(`/field/cm/${v.cm_project_id}/visits/${v.id}`)}
                  className="w-full rounded-xl border border-slate-700/50 bg-slate-800 p-4 text-left transition-colors hover:bg-slate-700/60"
                >
                  <p className="text-sm font-semibold text-slate-100">{project?.project_name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{building?.property_name}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                    <span>Visit #{v.visit_number}</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(v.visit_date), "MMM d, yyyy")}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Coming Soon */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Coming Soon
        </h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {comingSoon.map((item) => (
            <div
              key={item.title}
              className="relative rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 opacity-50"
            >
              <Lock className="h-5 w-5 text-slate-500" />
              <p className="mt-2 text-sm font-semibold text-slate-300">{item.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{item.desc}</p>
              <span className="absolute right-3 top-3 rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                Coming Soon
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
