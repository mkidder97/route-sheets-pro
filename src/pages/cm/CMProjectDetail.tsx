import { useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Pencil,
  Loader2,
  CalendarIcon,
  ClipboardList,
  Download,
  FileText,
  Building2,
  User,
  Plus,
  RefreshCw,
} from "lucide-react";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: "active", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  on_hold: { label: "on hold", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  complete: { label: "complete", className: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
};

const VISIT_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: "draft", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  submitted: { label: "submitted", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
};

interface ContactEntry {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
}

export default function CMProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOffice = !location.pathname.startsWith("/field");

  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [visitDate, setVisitDate] = useState<Date>(new Date());
  const [inspectorId, setInspectorId] = useState<string>("");
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);

  const handleGeneratePdf = async (visitId: string) => {
    setGeneratingPdfId(visitId);
    try {
      const { data, error } = await supabase.functions.invoke("generate-cm-report", {
        body: { visitId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: ["cm-visits", projectId] });
      toast.success("PDF generated successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate PDF");
    } finally {
      setGeneratingPdfId(null);
    }
  };

  // ── Project with building ──
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["cm-project-detail", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cm_projects")
        .select("*, buildings!inner(property_name, address, city, state, zip_code)")
        .eq("id", projectId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // ── Visits ──
  const { data: visits, isLoading: visitsLoading } = useQuery({
    queryKey: ["cm-visits", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cm_visits")
        .select("*")
        .eq("cm_project_id", projectId!)
        .order("visit_number", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // ── Inspector names for visit cards ──
  const inspectorIds = visits?.map((v) => v.inspector_id).filter(Boolean) as string[] | undefined;
  const { data: inspectorProfiles } = useQuery({
    queryKey: ["cm-visit-inspectors", inspectorIds],
    queryFn: async () => {
      if (!inspectorIds?.length) return {};
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name")
        .in("id", inspectorIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const p of data) map[p.id] = p.full_name;
      return map;
    },
    enabled: !!inspectorIds?.length,
  });

  // ── Inspector dropdown (two-step: user_roles → user_profiles) ──
  const { data: assignableInspectors } = useQuery({
    queryKey: ["assignable-inspectors"],
    queryFn: async () => {
      const { data: roleRows, error: roleErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["inspector", "construction_manager"]);
      if (roleErr) throw roleErr;
      const userIds = roleRows.map((r) => r.user_id);
      if (!userIds.length) return [];
      const { data: profiles, error: profErr } = await supabase
        .from("user_profiles")
        .select("id, full_name")
        .in("id", userIds)
        .eq("is_active", true)
        .order("full_name");
      if (profErr) throw profErr;
      return profiles;
    },
    enabled: isOffice,
  });

  // ── Checklist sections ──
  const { data: sections } = useQuery({
    queryKey: ["cm-project-sections", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cm_project_sections")
        .select("*")
        .eq("cm_project_id", projectId!)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // ── Create visit mutation ──
  const createVisit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cm_visits").insert({
        cm_project_id: projectId!,
        visit_date: format(visitDate, "yyyy-MM-dd"),
        inspector_id: inspectorId || null,
        status: "draft",
        visit_number: 0, // trigger overrides
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cm-visits", projectId] });
      setShowScheduleForm(false);
      setVisitDate(new Date());
      setInspectorId("");
      toast.success("Visit scheduled");
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Building2 className="h-12 w-12 opacity-20" />
        <p className="mt-3 text-sm font-medium">Project not found</p>
      </div>
    );
  }

  const bld = project.buildings as any;
  const badge = STATUS_BADGE[project.status] ?? STATUS_BADGE.active;
  const ownerContacts = (project.owner_contacts ?? []) as ContactEntry[];
  const contractorContacts = (project.contractor_contacts ?? []) as ContactEntry[];
  const ccList = (project.cc_list ?? []) as ContactEntry[];

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold">{project.project_name}</h1>
            <Badge className={badge.className}>{badge.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {bld?.property_name} · {bld?.address}, {bld?.city}, {bld?.state} {bld?.zip_code}
          </p>
        </div>
        {isOffice && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast.info("Edit coming soon")}>
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="visits">
        <TabsList>
          <TabsTrigger value="visits">Visits</TabsTrigger>
          <TabsTrigger value="info">Project Info</TabsTrigger>
        </TabsList>

        {/* ━━ VISITS TAB ━━ */}
        <TabsContent value="visits" className="space-y-4 mt-4">
          {/* Schedule Visit button (office only) */}
          {isOffice && !showScheduleForm && (
            <div className="flex justify-end">
              <Button size="sm" className="gap-1.5" onClick={() => setShowScheduleForm(true)}>
                <Plus className="h-3.5 w-3.5" />
                Schedule Visit
              </Button>
            </div>
          )}

          {/* Inline schedule form */}
          {isOffice && showScheduleForm && (
            <Card className="bg-slate-800 border-slate-700/50">
              <CardContent className="p-5 space-y-4">
                <h3 className="text-sm font-semibold">Schedule New Visit</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Date picker */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Visit Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal bg-slate-900 border-slate-600",
                            !visitDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {visitDate ? format(visitDate, "MMM d, yyyy") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={visitDate}
                          onSelect={(d) => d && setVisitDate(d)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Inspector select */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Assign Inspector</Label>
                    <Select value={inspectorId} onValueChange={setInspectorId}>
                      <SelectTrigger className="bg-slate-900 border-slate-600">
                        <SelectValue placeholder="Select inspector…" />
                      </SelectTrigger>
                      <SelectContent>
                        {assignableInspectors?.map((insp) => (
                          <SelectItem key={insp.id} value={insp.id}>
                            {insp.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={() => createVisit.mutate()} disabled={createVisit.isPending}>
                    {createVisit.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                    Create Visit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowScheduleForm(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Visit list */}
          {visitsLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}

          {!visitsLoading && (!visits || visits.length === 0) && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ClipboardList className="h-12 w-12 text-slate-500 opacity-20 mb-3" />
              <p className="text-sm text-muted-foreground">
                {isOffice
                  ? "No visits yet. Use Schedule Visit to create one."
                  : "No visits assigned to this project."}
              </p>
            </div>
          )}

          {!visitsLoading && visits && visits.length > 0 && (
            <div className="space-y-2">
              {visits.map((visit) => {
                const vBadge = VISIT_STATUS_BADGE[visit.status] ?? VISIT_STATUS_BADGE.draft;
                const inspName = visit.inspector_id
                  ? inspectorProfiles?.[visit.inspector_id] ?? "Loading…"
                  : "Unassigned";

                return (
                  <Card
                    key={visit.id}
                    className="bg-slate-800 border-slate-700/50 hover:border-slate-600 transition-colors cursor-pointer"
                    onClick={() => navigate(`/field/cm/${projectId}/visits/${visit.id}`)}
                  >
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">Visit #{visit.visit_number}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(visit.visit_date), "MM/dd/yyyy")}
                          </span>
                          <Badge className={cn("text-[10px]", vBadge.className)}>{vBadge.label}</Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          {inspName}
                        </div>
                      </div>

                      {/* PDF actions (office only, submitted) */}
                      {isOffice && visit.status === "submitted" && (
                        <div onClick={(e) => e.stopPropagation()}>
                          {visit.pdf_path ? (
                            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" asChild>
                              <a href={visit.pdf_path} target="_blank" rel="noopener noreferrer">
                                <Download className="h-3.5 w-3.5" />
                                PDF
                              </a>
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1.5 text-xs"
                              onClick={() => toast.info("PDF generation coming soon")}
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Generate PDF
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ━━ PROJECT INFO TAB ━━ */}
        <TabsContent value="info" className="space-y-6 mt-4">
          <Accordion type="multiple" defaultValue={["project", "owner", "contractor", "cc", "checklist"]}>
            {/* Project */}
            <AccordionItem value="project">
              <AccordionTrigger className="text-sm font-semibold">Project</AccordionTrigger>
              <AccordionContent>
                <InfoGrid>
                  <InfoField label="Project Name" value={project.project_name} />
                  <InfoField label="RI Number" value={project.ri_number} />
                  <InfoField label="Membrane Type" value={project.membrane_type} />
                  <InfoField label="Status" value={project.status} />
                  <InfoField
                    label="Contract Start"
                    value={project.contract_start_date ? format(new Date(project.contract_start_date), "MMM d, yyyy") : null}
                  />
                  <InfoField
                    label="Contract Completion"
                    value={project.contract_completion_date ? format(new Date(project.contract_completion_date), "MMM d, yyyy") : null}
                  />
                  <InfoField label="Total Contract Days" value={project.total_contract_days?.toString()} />
                </InfoGrid>
              </AccordionContent>
            </AccordionItem>

            {/* Owner */}
            <AccordionItem value="owner">
              <AccordionTrigger className="text-sm font-semibold">Owner</AccordionTrigger>
              <AccordionContent>
                <InfoGrid>
                  <InfoField label="Company" value={project.owner_company} />
                  <InfoField label="Address" value={project.owner_address} />
                  <InfoField label="City/State/ZIP" value={project.owner_city_state_zip} />
                </InfoGrid>
                {ownerContacts.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Contacts</p>
                    {ownerContacts.map((c, i) => (
                      <ContactCard key={i} contact={c} />
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Contractor */}
            <AccordionItem value="contractor">
              <AccordionTrigger className="text-sm font-semibold">Roofing Contractor</AccordionTrigger>
              <AccordionContent>
                <InfoGrid>
                  <InfoField label="Contractor Name" value={project.contractor_name} />
                </InfoGrid>
                {contractorContacts.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Contacts</p>
                    {contractorContacts.map((c, i) => (
                      <ContactCard key={i} contact={c} />
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* CC List */}
            <AccordionItem value="cc">
              <AccordionTrigger className="text-sm font-semibold">CC List</AccordionTrigger>
              <AccordionContent>
                {ccList.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No CC recipients configured.</p>
                ) : (
                  <div className="space-y-2">
                    {ccList.map((c, i) => (
                      <ContactCard key={i} contact={c} />
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Checklist Sections */}
            <AccordionItem value="checklist">
              <AccordionTrigger className="text-sm font-semibold">Checklist Sections</AccordionTrigger>
              <AccordionContent>
                {(!sections || sections.length === 0) ? (
                  <p className="text-xs text-muted-foreground">No checklist sections configured.</p>
                ) : (
                  <Accordion type="multiple" className="pl-2">
                    {sections.map((sec) => {
                      const items = (sec.checklist_items ?? []) as string[];
                      return (
                        <AccordionItem key={sec.id} value={sec.id}>
                          <AccordionTrigger className="text-xs font-medium">{sec.section_title}</AccordionTrigger>
                          <AccordionContent>
                            {items.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No items.</p>
                            ) : (
                              <ol className="list-decimal list-inside space-y-1">
                                {items.map((item, idx) => (
                                  <li key={idx} className="text-xs text-slate-300">{item}</li>
                                ))}
                              </ol>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {isOffice && (
            <Button variant="outline" size="sm" onClick={() => toast.info("Edit coming soon")}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit Project
            </Button>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Helpers ── */

function InfoGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">{children}</div>;
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-sm text-slate-200">{value || "—"}</p>
    </div>
  );
}

function ContactCard({ contact }: { contact: ContactEntry }) {
  return (
    <div className="rounded-md bg-slate-900/50 border border-slate-700/30 px-3 py-2 text-xs space-y-0.5">
      {contact.name && <p className="text-slate-200 font-medium">{contact.name}</p>}
      {contact.role && <p className="text-muted-foreground">{contact.role}</p>}
      {contact.email && <p className="text-muted-foreground">{contact.email}</p>}
      {contact.phone && <p className="text-muted-foreground">{contact.phone}</p>}
    </div>
  );
}
