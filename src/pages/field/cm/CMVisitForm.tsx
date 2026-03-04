import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Menu, ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

interface VisitData {
  id: string;
  visit_number: number;
  visit_date: string;
  status: string;
  src_associate_id: string | null;
  submitted_at: string | null;
  cm_project_id: string;
}

interface ProjectData {
  id: string;
  project_name: string;
  owner_company: string | null;
  owner_address: string | null;
  owner_city_state_zip: string | null;
  owner_contacts: any[];
  contractor_name: string | null;
  contractor_contacts: any[];
  buildings: {
    property_name: string;
    address: string;
    city: string;
    state: string;
    zip_code: string;
  };
}

interface VisitSection {
  id: string;
  section_title: string;
  checklist_items: any[];
  sort_order: number;
  notes: string | null;
  cm_project_section_id: string | null;
}

interface AssociateOption {
  id: string;
  full_name: string;
  phone: string | null;
  email: string;
}

type SaveStatus = "idle" | "saving" | "saved";

export default function CMVisitForm() {
  const { projectId, visitId } = useParams<{ projectId: string; visitId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [visit, setVisit] = useState<VisitData | null>(null);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [sections, setSections] = useState<VisitSection[]>([]);
  const [associates, setAssociates] = useState<AssociateOption[]>([]);
  const [srcAssociate, setSrcAssociate] = useState<AssociateOption | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [loading, setLoading] = useState(true);

  const initRef = useRef(false);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const sectionNotesLocal = useRef<Record<string, string>>({});

  const isSubmitted = visit?.status === "submitted";

  // Step definitions
  const staticStepsBefore = [
    "PROJECT",
    "OWNER",
    "ROOF CONSULTANT",
    "ROOFING CONTRACTOR",
    "WEATHER & OVERVIEW",
  ];
  const staticStepsAfter = ["COMPLETION & SCHEDULE", "PHOTO GRID"];
  const dynamicStepNames = sections.map((s) => s.section_title.toUpperCase());
  const allSteps = [...staticStepsBefore, ...dynamicStepNames, ...staticStepsAfter];
  const totalSteps = allSteps.length;

  // Auto-save helper
  const debouncedSave = useCallback(
    (table: string, id: string, payload: Record<string, any>, key?: string) => {
      const timerKey = key || `${table}-${id}`;
      if (debounceTimers.current[timerKey]) {
        clearTimeout(debounceTimers.current[timerKey]);
      }
      debounceTimers.current[timerKey] = setTimeout(async () => {
        setSaveStatus("saving");
        const { error } = await (supabase.from(table as any) as any).update(payload).eq("id", id);
        setSaveStatus(error ? "idle" : "saved");
        if (!error) {
          setTimeout(() => setSaveStatus("idle"), 2000);
        }
      }, 1500);
    },
    []
  );

  // Fetch all data
  useEffect(() => {
    if (!projectId || !visitId) return;

    const fetchData = async () => {
      const [visitRes, projectRes, sectionsRes] = await Promise.all([
        supabase.from("cm_visits").select("*").eq("id", visitId).single(),
        supabase
          .from("cm_projects")
          .select("id, project_name, owner_company, owner_address, owner_city_state_zip, owner_contacts, contractor_name, contractor_contacts, buildings(property_name, address, city, state, zip_code)")
          .eq("id", projectId)
          .single(),
        supabase
          .from("cm_visit_sections")
          .select("*")
          .eq("cm_visit_id", visitId)
          .order("sort_order"),
      ]);

      if (visitRes.data) setVisit(visitRes.data as unknown as VisitData);
      if (projectRes.data) setProject(projectRes.data as unknown as ProjectData);
      if (sectionsRes.data) setSections(sectionsRes.data as unknown as VisitSection[]);

      // Init local notes cache
      if (sectionsRes.data) {
        for (const s of sectionsRes.data as unknown as VisitSection[]) {
          sectionNotesLocal.current[s.id] = s.notes || "";
        }
      }

      // Fetch src_associate if set
      if (visitRes.data?.src_associate_id) {
        const { data: assocProfile } = await supabase
          .from("user_profiles")
          .select("id, full_name, phone, email")
          .eq("id", visitRes.data.src_associate_id)
          .single();
        if (assocProfile) setSrcAssociate(assocProfile as AssociateOption);
      }

      setLoading(false);
    };

    fetchData();
  }, [projectId, visitId]);

  // Section initialization — runs once
  useEffect(() => {
    if (!visitId || !projectId || initRef.current || loading) return;
    if (sections.length > 0) {
      initRef.current = true;
      return;
    }

    initRef.current = true;

    const initSections = async () => {
      const { data: count } = await supabase
        .from("cm_visit_sections")
        .select("id", { count: "exact", head: true })
        .eq("cm_visit_id", visitId);

      // Double-check count is 0 (sections state may lag)
      if (count && (count as any[]).length > 0) return;

      const { data: templateSections } = await supabase
        .from("cm_project_sections")
        .select("*")
        .eq("cm_project_id", projectId)
        .order("sort_order");

      if (!templateSections || templateSections.length === 0) return;

      const inserts = templateSections.map((s) => ({
        cm_visit_id: visitId,
        cm_project_section_id: s.id,
        section_title: s.section_title,
        checklist_items: s.checklist_items,
        sort_order: s.sort_order,
      }));

      await supabase.from("cm_visit_sections").insert(inserts);

      // Refetch
      const { data: newSections } = await supabase
        .from("cm_visit_sections")
        .select("*")
        .eq("cm_visit_id", visitId)
        .order("sort_order");

      if (newSections) {
        const typed = newSections as unknown as VisitSection[];
        setSections(typed);
        for (const s of typed) {
          sectionNotesLocal.current[s.id] = s.notes || "";
        }
      }
    };

    initSections();
  }, [visitId, projectId, loading, sections.length]);

  // Fetch associate options for step 3
  useEffect(() => {
    if (isSubmitted && visit?.src_associate_id) return;

    const fetchAssociates = async () => {
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["inspector", "construction_manager"]);

      if (!roleRows || roleRows.length === 0) return;

      const userIds = roleRows.map((r: any) => r.user_id);
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, full_name, phone, email")
        .in("id", userIds)
        .eq("is_active", true)
        .order("full_name");

      if (profiles) setAssociates(profiles as AssociateOption[]);
    };

    fetchAssociates();
  }, [isSubmitted, visit?.src_associate_id]);

  // Notes change handler
  const handleNotesChange = (sectionId: string, value: string) => {
    sectionNotesLocal.current[sectionId] = value;
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, notes: value } : s))
    );
    debouncedSave("cm_visit_sections", sectionId, { notes: value });
  };

  // SRC associate change
  const handleAssociateChange = (userId: string) => {
    if (!visit) return;
    const selected = associates.find((a) => a.id === userId);
    if (selected) {
      setSrcAssociate(selected);
      setVisit({ ...visit, src_associate_id: userId });
      debouncedSave("cm_visits", visit.id, { src_associate_id: userId }, "src_associate");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!visit || !project) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        Visit not found.
      </div>
    );
  }

  const building = project.buildings;
  const ownerContacts = Array.isArray(project.owner_contacts) ? project.owner_contacts : [];
  const contractorContacts = Array.isArray(project.contractor_contacts) ? project.contractor_contacts : [];

  // Render step content
  const renderStep = () => {
    // Step 0: PROJECT
    if (currentStep === 0) {
      return (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
            <p className="text-sm font-bold text-slate-100">
              FIELD OBSERVATION REPORT: #{visit.visit_number}
            </p>
            <p className="text-sm text-slate-400">
              DATE: {format(new Date(visit.visit_date + "T00:00:00"), "MM/dd/yyyy")}
            </p>
          </div>
          <div className="mt-4 space-y-1">
            <p className="text-base font-bold text-slate-100">{project.project_name}</p>
            <p className="text-sm text-slate-300">{building.address}</p>
            <p className="text-sm text-slate-400">
              {building.city}, {building.state} {building.zip_code}
            </p>
          </div>
        </div>
      );
    }

    // Step 1: OWNER
    if (currentStep === 1) {
      return (
        <div className="space-y-4">
          {project.owner_company && (
            <p className="text-base font-bold text-slate-100">{project.owner_company}</p>
          )}
          {project.owner_address && (
            <p className="text-sm text-slate-300">{project.owner_address}</p>
          )}
          {project.owner_city_state_zip && (
            <p className="text-sm text-slate-400">{project.owner_city_state_zip}</p>
          )}
          {ownerContacts.length > 0 && (
            <div className="mt-4 space-y-3">
              {ownerContacts.map((c: any, i: number) => (
                <div key={i} className="rounded-lg bg-slate-800 border border-slate-700/50 p-3 space-y-1">
                  <p className="text-sm font-semibold text-slate-100">
                    {c.name}{c.title ? `, ${c.title}` : ""}
                  </p>
                  {c.phone && <p className="text-xs text-slate-400">Phone: {c.phone}</p>}
                  {c.email && <p className="text-xs text-slate-400">Email: {c.email}</p>}
                </div>
              ))}
            </div>
          )}
          {!project.owner_company && ownerContacts.length === 0 && (
            <p className="text-sm text-slate-500 italic">No owner information on file.</p>
          )}
        </div>
      );
    }

    // Step 2: ROOF CONSULTANT
    if (currentStep === 2) {
      return (
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-800 border border-slate-700/50 p-4 space-y-1">
            <p className="text-sm font-bold text-slate-100">Southern Roof Consultants (SRC)</p>
            <p className="text-xs text-slate-300">875 Pasadena Avenue S - Suite A, South Pasadena, FL 33707</p>
            <p className="text-xs text-slate-300 mt-2 font-semibold">John Biggers, President</p>
            <p className="text-xs text-slate-400">Office: (727) 362-0116 ext. 205 &nbsp;|&nbsp; Cell: (727) 698-4977</p>
            <p className="text-xs text-slate-400">Email: jbiggers@southernroof.biz</p>
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
              SRC Associate
            </p>
            {!srcAssociate && !isSubmitted ? (
              <Select onValueChange={handleAssociateChange}>
                <SelectTrigger className="bg-slate-900 border-slate-600 text-slate-100">
                  <SelectValue placeholder="Select associate..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {associates.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : srcAssociate ? (
              <div className="rounded-lg bg-slate-800 border border-slate-700/50 p-3 space-y-1">
                <p className="text-sm font-semibold text-slate-100">{srcAssociate.full_name}</p>
                {srcAssociate.phone && <p className="text-xs text-slate-400">Phone: {srcAssociate.phone}</p>}
                <p className="text-xs text-slate-400">Email: {srcAssociate.email}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">No associate assigned.</p>
            )}
          </div>
        </div>
      );
    }

    // Step 3: ROOFING CONTRACTOR
    if (currentStep === 3) {
      return (
        <div className="space-y-4">
          {project.contractor_name && (
            <p className="text-base font-bold text-slate-100">{project.contractor_name}</p>
          )}
          {contractorContacts.length > 0 ? (
            <div className="space-y-3">
              {contractorContacts.map((c: any, i: number) => (
                <div key={i} className="rounded-lg bg-slate-800 border border-slate-700/50 p-3 space-y-1">
                  <p className="text-sm font-semibold text-slate-100">
                    {c.name}{c.title ? `, ${c.title}` : ""}
                  </p>
                  {c.phone && <p className="text-xs text-slate-400">Phone: {c.phone}</p>}
                  {c.email && <p className="text-xs text-slate-400">Email: {c.email}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">No contractor contacts on file.</p>
          )}
        </div>
      );
    }

    // Step 4: WEATHER & OVERVIEW (placeholder)
    if (currentStep === 4) {
      return (
        <div className="flex items-center justify-center h-48">
          <p className="text-sm text-slate-500 italic">Coming in next prompt</p>
        </div>
      );
    }

    // Dynamic checklist sections (steps 5 to 5 + sections.length - 1)
    const dynamicIndex = currentStep - staticStepsBefore.length;
    if (dynamicIndex >= 0 && dynamicIndex < sections.length) {
      const section = sections[dynamicIndex];
      const items = Array.isArray(section.checklist_items) ? section.checklist_items : [];

      return (
        <div className="space-y-4">
          {items.length > 0 && (
            <ol className="list-decimal list-inside space-y-1">
              {items.map((item: any, i: number) => (
                <li key={i} className="text-sm text-slate-300">
                  {typeof item === "string" ? item : item.text || item.label || JSON.stringify(item)}
                </li>
              ))}
            </ol>
          )}

          <div className="mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Notes</p>
            <Textarea
              className="bg-slate-900 border-slate-600 text-slate-100 min-h-[120px] resize-y"
              rows={4}
              value={section.notes || ""}
              onChange={(e) => handleNotesChange(section.id, e.target.value)}
              readOnly={isSubmitted}
              placeholder="Add notes for this section..."
            />
          </div>
        </div>
      );
    }

    // Placeholder steps at end
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-sm text-slate-500 italic">Coming in next prompt</p>
      </div>
    );
  };

  const progressPct = totalSteps > 1 ? ((currentStep + 1) / totalSteps) * 100 : 100;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="flex flex-col h-full -m-4 bg-slate-900">
      {/* Submitted banner */}
      {isSubmitted && (
        <div className="bg-amber-900/60 border-b border-amber-700/50 px-4 py-2 text-center">
          <p className="text-xs text-amber-200">
            This visit was submitted on{" "}
            {visit.submitted_at
              ? format(new Date(visit.submitted_at), "MM/dd/yyyy")
              : "unknown date"}
            . Contact the office to make changes.
          </p>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center h-12 shrink-0 border-b border-slate-700/50 px-3">
        <button
          onClick={() => setTocOpen(true)}
          className="p-2 -ml-2 rounded-md text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
          aria-label="Table of contents"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-center text-xs font-bold uppercase tracking-wider text-slate-100 truncate px-2">
          {allSteps[currentStep] || ""}
        </h1>
        <div className="text-xs text-slate-400 min-w-[60px] text-right">
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1 justify-end text-amber-400">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving...
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 justify-end text-emerald-400">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4">{renderStep()}</div>

      {/* Progress bar */}
      <div className="h-[3px] bg-slate-800 shrink-0">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${progressPct}%`, backgroundColor: "#0F766E" }}
        />
      </div>

      {/* Bottom nav */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-slate-700/50 shrink-0">
        <Button
          variant="outline"
          className="min-h-[44px] min-w-[44px] border-slate-600 text-slate-300 hover:bg-slate-700/50"
          disabled={currentStep === 0}
          onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
        >
          <ChevronLeft className="h-5 w-5 mr-1" /> Back
        </Button>
        {isLastStep ? (
          <Button
            className="min-h-[44px] bg-slate-700 text-slate-400 cursor-not-allowed"
            disabled
          >
            Submit Visit
          </Button>
        ) : (
          <Button
            className="min-h-[44px] bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => setCurrentStep((s) => Math.min(totalSteps - 1, s + 1))}
          >
            Next <ChevronRight className="h-5 w-5 ml-1" />
          </Button>
        )}
      </div>

      {/* TOC Drawer */}
      <Sheet open={tocOpen} onOpenChange={setTocOpen}>
        <SheetContent side="left" className="bg-slate-900 border-slate-700 w-72 p-0">
          <SheetHeader className="px-4 pt-4 pb-2 border-b border-slate-700/50">
            <SheetTitle className="text-slate-100 text-sm font-bold">Visit Steps</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto py-2">
            {allSteps.map((name, i) => (
              <button
                key={i}
                className={`flex items-center gap-3 w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  i === currentStep
                    ? "bg-slate-800 text-slate-100 font-medium"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                }`}
                onClick={() => {
                  setCurrentStep(i);
                  setTocOpen(false);
                }}
              >
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    i === currentStep ? "bg-emerald-500" : "bg-slate-700"
                  }`}
                />
                <span className="truncate">{name}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
