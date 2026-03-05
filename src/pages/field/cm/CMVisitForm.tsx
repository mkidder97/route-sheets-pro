import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Menu, ChevronLeft, ChevronRight, Check, Loader2, Plus, Trash2, ArrowUp, ArrowDown, X, Camera, ImagePlus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";

interface VisitData {
  id: string;
  visit_number: number;
  visit_date: string;
  status: string;
  src_associate_id: string | null;
  submitted_at: string | null;
  cm_project_id: string;
  weather_rain_pct: string | null;
  weather_wind_mph: string | null;
  weather_temp_range: string | null;
  overview_narrative: string | null;
  completion_tpo_delivered_pct: number | null;
  completion_membrane_pct: number | null;
  completion_flashing_pct: number | null;
  completion_sheet_metal_pct: number | null;
  schedule_days_used: number | null;
  schedule_weather_days_credited: number;
  schedule_days_remaining: number | null;
  unit_qty_infill_sf: number;
  unit_qty_deck_coating_sf: number;
  unit_qty_deck_replaced_sf: number;
  general_notes: string | null;
  internal_notes: string | null;
  custom_photo_labels?: string[];
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
  contract_completion_date: string | null;
  total_contract_days: number | null;
  cc_list: any[];
  buildings: {
    property_name: string;
    address: string;
    city: string;
    state: string;
    zip_code: string;
    square_footage: number | null;
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

interface CmPhoto {
  id: string;
  cm_visit_id: string;
  photo_number: number;
  description: string | null;
  label: string | null;
  storage_path: string;
  public_url: string;
  sort_order: number;
}

type SaveStatus = "idle" | "saving" | "saved";

const DEFAULT_LABELS = ["Overview", "Detail", "Punch Item"];

export default function CMVisitForm() {
  const { projectId, visitId } = useParams<{ projectId: string; visitId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [visit, setVisit] = useState<VisitData | null>(null);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [sections, setSections] = useState<VisitSection[]>([]);
  const [associates, setAssociates] = useState<AssociateOption[]>([]);
  const [srcAssociate, setSrcAssociate] = useState<AssociateOption | null>(null);
  const [photos, setPhotos] = useState<CmPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [loading, setLoading] = useState(true);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [deletePhotoId, setDeletePhotoId] = useState<string | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // FAB state
  const [fabSheetOpen, setFabSheetOpen] = useState(false);
  const [labelQueue, setLabelQueue] = useState<File[]>([]);
  const [currentLabelFile, setCurrentLabelFile] = useState<File | null>(null);
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const [newLabelText, setNewLabelText] = useState("");
  const [photoNote, setPhotoNote] = useState("");
  const [fabUploading, setFabUploading] = useState(false);

  const initRef = useRef(false);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const sectionNotesLocal = useRef<Record<string, string>>({});
  const photoInputRef = useRef<HTMLInputElement>(null);
  const takePhotoRef = useRef<HTMLInputElement>(null);
  const uploadPhotoRef = useRef<HTMLInputElement>(null);

  const isSubmitted = visit?.status === "submitted";

  // Custom labels from visit
  const customLabels = visit?.custom_photo_labels ?? [];
  const allLabelOptions = [...DEFAULT_LABELS, ...customLabels];

  // Ground section filtering
  const groundSection = sections.find((s) =>
    s.section_title.toLowerCase().includes("ground")
  );
  const displaySections = sections.filter((s) => s.id !== groundSection?.id);

  // Step definitions — photo grid title is dynamic
  const staticStepsBefore = [
    "PROJECT",
    "OWNER",
    "ROOF CONSULTANT",
    "ROOFING CONTRACTOR",
    "WEATHER & OVERVIEW",
  ];
  const staticStepsAfter = ["COMPLETION & SCHEDULE"];
  const dynamicStepNames = displaySections.map((s) => s.section_title.toUpperCase());
  const allSteps = [...staticStepsBefore, ...dynamicStepNames, ...staticStepsAfter];
  const totalSteps = allSteps.length;
  const isLastStep = currentStep === totalSteps - 1;
  const isPhotoStep = isLastStep; // photos now live inside the completion step

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

  // Generic visit field change handler
  const handleVisitFieldChange = useCallback(
    (field: keyof VisitData, value: any) => {
      if (!visit) return;
      const updated = { ...visit, [field]: value };

      // Recalculate schedule_days_remaining for schedule fields
      if (field === "schedule_days_used" || field === "schedule_weather_days_credited") {
        const totalDays = project?.total_contract_days || 0;
        const daysUsed = field === "schedule_days_used" ? (value ?? 0) : (updated.schedule_days_used ?? 0);
        const weatherDays = field === "schedule_weather_days_credited" ? (value ?? 0) : (updated.schedule_weather_days_credited ?? 0);
        updated.schedule_days_remaining = totalDays + weatherDays - daysUsed;
      }

      setVisit(updated);

      // Build save payload
      const savePayload: Record<string, any> = { [field]: value };
      if (field === "schedule_days_used" || field === "schedule_weather_days_credited") {
        savePayload.schedule_days_remaining = updated.schedule_days_remaining;
      }
      debouncedSave("cm_visits", visit.id, savePayload, `visit-${field}`);
    },
    [visit, project, debouncedSave]
  );

  // Fetch all data
  useEffect(() => {
    if (!projectId || !visitId) return;

    const fetchData = async () => {
      const [visitRes, projectRes, sectionsRes, photosRes] = await Promise.all([
        supabase.from("cm_visits").select("*").eq("id", visitId).single(),
        supabase
          .from("cm_projects")
          .select("id, project_name, owner_company, owner_address, owner_city_state_zip, owner_contacts, contractor_name, contractor_contacts, contract_completion_date, total_contract_days, cc_list, buildings(property_name, address, city, state, zip_code, square_footage)")
          .eq("id", projectId)
          .single(),
        supabase
          .from("cm_visit_sections")
          .select("*")
          .eq("cm_visit_id", visitId)
          .order("sort_order"),
        supabase
          .from("cm_photos")
          .select("*")
          .eq("cm_visit_id", visitId)
          .order("sort_order"),
      ]);

      if (visitRes.data) {
        const vd = visitRes.data as any;
        setVisit({
          ...vd,
          custom_photo_labels: vd.custom_photo_labels ?? [],
        } as VisitData);
      }
      if (projectRes.data) setProject(projectRes.data as unknown as ProjectData);
      if (sectionsRes.data) setSections(sectionsRes.data as unknown as VisitSection[]);
      if (photosRes.data) setPhotos(photosRes.data as unknown as CmPhoto[]);

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

  // === PHOTO OPERATIONS ===

  const handlePhotoUpload = async (file: File) => {
    if (!visitId || !visit || isSubmitted) return;
    setUploading(true);

    try {
      const uuid = crypto.randomUUID();
      const storagePath = `visits/${visitId}/${uuid}.jpg`;

      const { error: uploadErr } = await supabase.storage
        .from("cm-reports")
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      if (uploadErr) {
        toast.error("Upload failed: " + uploadErr.message);
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("cm-reports")
        .getPublicUrl(storagePath);

      const nextPhotoNum = photos.length > 0
        ? Math.max(...photos.map((p) => p.photo_number)) + 1
        : 1;

      const newRow = {
        cm_visit_id: visitId,
        photo_number: nextPhotoNum,
        sort_order: photos.length,
        storage_path: storagePath,
        public_url: urlData.publicUrl,
        description: null,
      };

      const { data: inserted, error: insertErr } = await supabase
        .from("cm_photos")
        .insert(newRow)
        .select()
        .single();

      if (insertErr) {
        toast.error("Failed to save photo record.");
      } else if (inserted) {
        setPhotos((prev) => [...prev, inserted as unknown as CmPhoto]);
        toast.success(`Photo #${nextPhotoNum} added.`);
      }
    } catch {
      toast.error("Upload error.");
    } finally {
      setUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlePhotoUpload(file);
  };

  // === FAB PHOTO UPLOAD WITH LABEL ===

  const handleFabFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setFabSheetOpen(false);

    // Queue all files for labeling
    setLabelQueue(files.slice(1));
    setCurrentLabelFile(files[0]);
    setSelectedLabel("");
    setNewLabelText("");
    setPhotoNote("");
    setLabelModalOpen(true);

    // Reset inputs
    if (takePhotoRef.current) takePhotoRef.current.value = "";
    if (uploadPhotoRef.current) uploadPhotoRef.current.value = "";
  };

  const handleFabPhotoUpload = async (file: File, label: string | null, note: string | null) => {
    if (!visitId || !visit) return;

    const uuid = crypto.randomUUID();
    const storagePath = `visits/${visitId}/${uuid}.jpg`;

    const { error: uploadErr } = await supabase.storage
      .from("cm-reports")
      .upload(storagePath, file, { contentType: file.type, upsert: false });

    if (uploadErr) {
      toast.error("Upload failed: " + uploadErr.message);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("cm-reports")
      .getPublicUrl(storagePath);

    const nextPhotoNum = photos.length > 0
      ? Math.max(...photos.map((p) => p.photo_number)) + 1
      : 1;

    const newRow = {
      cm_visit_id: visitId,
      photo_number: nextPhotoNum,
      sort_order: photos.length,
      storage_path: storagePath,
      public_url: urlData.publicUrl,
      description: note || null,
      label: label || null,
    };

    const { data: inserted, error: insertErr } = await supabase
      .from("cm_photos")
      .insert(newRow)
      .select()
      .single();

    if (insertErr) {
      toast.error("Failed to save photo record.");
    } else if (inserted) {
      setPhotos((prev) => [...prev, inserted as unknown as CmPhoto]);
      toast.success(`Photo #${nextPhotoNum} added.`);
    }
  };

  const processNextInQueue = () => {
    if (labelQueue.length > 0) {
      const next = labelQueue[0];
      setLabelQueue((prev) => prev.slice(1));
      setCurrentLabelFile(next);
      setSelectedLabel("");
      setNewLabelText("");
      setPhotoNote("");
      setLabelModalOpen(true);
    } else {
      setCurrentLabelFile(null);
      setLabelModalOpen(false);
    }
  };

  const handleLabelSave = async (skip: boolean) => {
    if (!currentLabelFile) return;
    setFabUploading(true);

    let labelToUse: string | null = null;
    let noteToUse: string | null = null;

    if (!skip) {
      // Handle "+ New Label"
      if (selectedLabel === "__new__" && newLabelText.trim()) {
        const trimmed = newLabelText.trim();
        labelToUse = trimmed;
        // Persist new custom label to visit
        const updatedLabels = [...customLabels, trimmed];
        setVisit((prev) => prev ? { ...prev, custom_photo_labels: updatedLabels } : prev);
        await (supabase.from("cm_visits" as any) as any)
          .update({ custom_photo_labels: updatedLabels })
          .eq("id", visit!.id);
      } else if (selectedLabel && selectedLabel !== "__new__") {
        labelToUse = selectedLabel;
      }
      noteToUse = photoNote.trim() || null;
    }

    await handleFabPhotoUpload(currentLabelFile, labelToUse, noteToUse);
    setFabUploading(false);
    processNextInQueue();
  };

  const confirmDeletePhoto = async () => {
    if (!deletePhotoId) return;
    const photo = photos.find((p) => p.id === deletePhotoId);
    if (!photo) return;

    // Delete from storage
    await supabase.storage.from("cm-reports").remove([photo.storage_path]);

    // Delete from table
    await supabase.from("cm_photos").delete().eq("id", photo.id);

    // Remove and renumber
    const remaining = photos.filter((p) => p.id !== photo.id);
    const renumbered = remaining.map((p, idx) => ({
      ...p,
      photo_number: idx + 1,
      sort_order: idx,
    }));

    // Batch update renumbered rows
    for (const p of renumbered) {
      await supabase
        .from("cm_photos")
        .update({ photo_number: p.photo_number, sort_order: p.sort_order })
        .eq("id", p.id);
    }

    setPhotos(renumbered);
    setDeletePhotoId(null);
    toast.success("Photo deleted.");
  };

  const handleReorder = async (index: number, direction: "up" | "down") => {
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= photos.length) return;

    const updated = [...photos];
    [updated[index], updated[swapIdx]] = [updated[swapIdx], updated[index]];

    const renumbered = updated.map((p, idx) => ({
      ...p,
      photo_number: idx + 1,
      sort_order: idx,
    }));

    setPhotos(renumbered);

    // Save all
    for (const p of renumbered) {
      await supabase
        .from("cm_photos")
        .update({ photo_number: p.photo_number, sort_order: p.sort_order })
        .eq("id", p.id);
    }
  };

  const handlePhotoDescChange = (photoId: string, value: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, description: value } : p))
    );
    debouncedSave("cm_photos", photoId, { description: value || null }, `photo-desc-${photoId}`);
  };

  // === SUBMIT VISIT ===

  const handleSubmitVisit = () => {
    if (!visit) return;

    // Non-blocking warning checks
    const warnings: string[] = [];
    if (!visit.overview_narrative) warnings.push("overview narrative");
    if (photos.length === 0) warnings.push("photos");
    if (!visit.src_associate_id) warnings.push("SRC associate");

    if (warnings.length > 0) {
      toast.warning("Some fields are incomplete. You can still submit or go back to fill them in.", {
        duration: 5000,
      });
    }

    setShowSubmitDialog(true);
  };

  const confirmSubmit = async () => {
    if (!visit || !projectId) return;
    setSubmitting(true);

    const { error } = await supabase
      .from("cm_visits")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", visit.id);

    if (error) {
      toast.error("Failed to submit visit.");
      setSubmitting(false);
      return;
    }

    setShowSubmitDialog(false);
    toast.success(`Visit #${visit.visit_number} submitted successfully`);
    navigate(`/field/cm/${projectId}`);
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
  const ccList = Array.isArray(project.cc_list) ? project.cc_list : [];

  // Helper: section label
  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
      {children}
    </p>
  );

  // Helper: labeled input row
  const LabeledInput = ({
    label,
    value,
    onChange,
    type = "text",
    placeholder,
    readOnly,
    min,
    max,
  }: {
    label: string;
    value: string | number;
    onChange: (val: string) => void;
    type?: string;
    placeholder?: string;
    readOnly?: boolean;
    min?: number;
    max?: number;
  }) => (
    <div className="space-y-1">
      <label className="text-xs text-slate-300 font-medium">{label}</label>
      <Input
        type={type}
        className="bg-slate-900 border-slate-600 text-slate-100"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly || isSubmitted}
        disabled={readOnly}
        min={min}
        max={max}
      />
    </div>
  );

  // Weather input with local state, onBlur save, and suffix adornment
  const WeatherInput = ({
    label,
    field,
    suffix,
    placeholder,
  }: {
    label: string;
    field: "weather_rain_pct" | "weather_wind_mph" | "weather_temp_range";
    suffix?: string;
    placeholder?: string;
  }) => {
    const stripSuffix = (val: string | null) => {
      if (!val) return "";
      if (suffix) return val.replace(new RegExp(`\\s*${suffix}\\s*$`, "i"), "").trim();
      return val;
    };

    const [local, setLocal] = useState(() => stripSuffix(visit?.[field] ?? null));

    const handleBlur = () => {
      if (!visit) return;
      let saveVal: string | null = local.trim() || null;
      if (saveVal && suffix && !saveVal.toLowerCase().endsWith(suffix.toLowerCase())) {
        saveVal = `${saveVal} ${suffix}`;
      }
      setVisit((prev) => prev ? { ...prev, [field]: saveVal } : prev);
      if (debounceTimers.current[`visit-${field}`]) {
        clearTimeout(debounceTimers.current[`visit-${field}`]);
      }
      debounceTimers.current[`visit-${field}`] = setTimeout(async () => {
        setSaveStatus("saving");
        const { error } = await (supabase.from("cm_visits" as any) as any)
          .update({ [field]: saveVal })
          .eq("id", visit.id);
        setSaveStatus(error ? "idle" : "saved");
        if (!error) setTimeout(() => setSaveStatus("idle"), 2000);
      }, 300);
    };

    return (
      <div className="space-y-1">
        <label className="text-xs text-slate-300 font-medium">{label}</label>
        <div className="relative flex items-center">
          <Input
            className="bg-slate-900 border-slate-600 text-slate-100 pr-12"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={handleBlur}
            placeholder={placeholder}
            readOnly={isSubmitted}
          />
          {suffix && (
            <span className="absolute right-3 text-xs text-slate-500 pointer-events-none select-none">
              {suffix}
            </span>
          )}
        </div>
      </div>
    );
  };

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
            <SectionLabel>SRC Associate</SectionLabel>
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

    // Step 4: WEATHER & OVERVIEW
    if (currentStep === 4) {
      return (
        <div className="space-y-6">
          {/* Weather Conditions */}
          <div>
            <SectionLabel>Weather Conditions</SectionLabel>
            <div className="space-y-3">
              <WeatherInput
                label="Chance of Rain:"
                field="weather_rain_pct"
                suffix="%"
                placeholder="e.g. <10"
              />
              <WeatherInput
                label="Winds:"
                field="weather_wind_mph"
                suffix="mph"
                placeholder="e.g. 3-5"
              />
              <WeatherInput
                label="Temperature Range:"
                field="weather_temp_range"
                suffix="°F"
                placeholder="e.g. 49-68"
              />
            </div>
          </div>

          {/* Overview Narrative */}
          <div>
            <SectionLabel>Overview of Today's Work</SectionLabel>
            <Textarea
              className="bg-slate-900 border-slate-600 text-slate-100 min-h-[120px] resize-y"
              value={visit.overview_narrative || ""}
              onChange={(e) => handleVisitFieldChange("overview_narrative", e.target.value || null)}
              readOnly={isSubmitted}
              placeholder="Describe the work observed today..."
            />
          </div>

          {/* Ground Conditions & Set-Up */}
          <div>
            <SectionLabel>Ground Conditions &amp; Set-Up</SectionLabel>
            {groundSection ? (
              <div className="space-y-4">
                {Array.isArray(groundSection.checklist_items) && groundSection.checklist_items.length > 0 && (
                  <ol className="list-decimal list-inside space-y-1">
                    {groundSection.checklist_items.map((item: any, i: number) => (
                      <li key={i} className="text-sm text-slate-300">
                        {typeof item === "string" ? item : item.text || item.label || JSON.stringify(item)}
                      </li>
                    ))}
                  </ol>
                )}
                <Textarea
                  className="bg-slate-900 border-slate-600 text-slate-100 min-h-[120px] resize-y"
                  value={groundSection.notes || ""}
                  onChange={(e) => handleNotesChange(groundSection.id, e.target.value)}
                  readOnly={isSubmitted}
                  placeholder="Add ground conditions notes..."
                />
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">
                No ground conditions checklist configured for this project.
              </p>
            )}
          </div>
        </div>
      );
    }

    // Dynamic checklist sections (using displaySections, ground filtered out)
    const dynamicIndex = currentStep - staticStepsBefore.length;
    if (dynamicIndex >= 0 && dynamicIndex < displaySections.length) {
      const section = displaySections[dynamicIndex];
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
            <SectionLabel>Notes</SectionLabel>
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

    // COMPLETION & SCHEDULE step
    const completionStepIndex = staticStepsBefore.length + displaySections.length;
    if (currentStep === completionStepIndex) {
      const sqFt = building.square_footage;
      const sqFtDisplay = sqFt != null ? sqFt.toLocaleString() : "--";
      const totalDays = project.total_contract_days || 0;
      const daysUsed = visit.schedule_days_used ?? 0;
      const weatherDays = visit.schedule_weather_days_credited ?? 0;
      const remaining = totalDays + weatherDays - daysUsed;

      return (
        <div className="space-y-6">
          {/* Observation of Completed Work */}
          <div>
            <SectionLabel>Observation of Completed Work</SectionLabel>
            <div className="space-y-3">
              <LabeledInput
                label="% TPO materials delivered on site."
                value={visit.completion_tpo_delivered_pct ?? ""}
                onChange={(v) => handleVisitFieldChange("completion_tpo_delivered_pct", v === "" ? null : Math.min(100, Math.max(0, parseInt(v) || 0)))}
                type="number"
                min={0}
                max={100}
              />
              <LabeledInput
                label={`% New membrane installed to date (${sqFtDisplay} SF).`}
                value={visit.completion_membrane_pct ?? ""}
                onChange={(v) => handleVisitFieldChange("completion_membrane_pct", v === "" ? null : Math.min(100, Math.max(0, parseInt(v) || 0)))}
                type="number"
                min={0}
                max={100}
              />
              <LabeledInput
                label="% Flashing details completed to date."
                value={visit.completion_flashing_pct ?? ""}
                onChange={(v) => handleVisitFieldChange("completion_flashing_pct", v === "" ? null : Math.min(100, Math.max(0, parseInt(v) || 0)))}
                type="number"
                min={0}
                max={100}
              />
              <LabeledInput
                label="% Sheet metal installed to date."
                value={visit.completion_sheet_metal_pct ?? ""}
                onChange={(v) => handleVisitFieldChange("completion_sheet_metal_pct", v === "" ? null : Math.min(100, Math.max(0, parseInt(v) || 0)))}
                type="number"
                min={0}
                max={100}
              />
            </div>
          </div>

          {/* Project Schedule */}
          <div>
            <SectionLabel>Project Schedule</SectionLabel>
            {project.contract_completion_date && (
              <p className="text-sm text-slate-300 mb-3">
                {format(new Date(project.contract_completion_date + "T00:00:00"), "MM/dd/yyyy")} — Calendar days to be substantially complete ({totalDays} days).
              </p>
            )}
            <div className="space-y-3">
              <LabeledInput
                label="Calendar days used to date."
                value={daysUsed}
                onChange={(v) => handleVisitFieldChange("schedule_days_used", v === "" ? null : parseInt(v) || 0)}
                type="number"
                min={0}
              />
              <LabeledInput
                label="Weather/Change Order days credited to date."
                value={weatherDays}
                onChange={(v) => handleVisitFieldChange("schedule_weather_days_credited", v === "" ? 0 : parseInt(v) || 0)}
                type="number"
                min={0}
              />
              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">Remaining calendar days:</label>
                <div className="rounded-md bg-slate-800 border border-slate-700/50 px-3 py-2 text-sm font-semibold text-slate-100">
                  {remaining}
                </div>
              </div>
            </div>
          </div>

          {/* Unit Price Quantities */}
          <div>
            <SectionLabel>Unit Price Quantities Installed to Date</SectionLabel>
            <div className="space-y-3">
              <LabeledInput
                label="SF of roof assembly removal/replacement with in-fill insulation."
                value={visit.unit_qty_infill_sf}
                onChange={(v) => handleVisitFieldChange("unit_qty_infill_sf", parseInt(v) || 0)}
                type="number"
                min={0}
              />
              <LabeledInput
                label="SF of rust-inhibiting deck coating installed to date."
                value={visit.unit_qty_deck_coating_sf}
                onChange={(v) => handleVisitFieldChange("unit_qty_deck_coating_sf", parseInt(v) || 0)}
                type="number"
                min={0}
              />
              <LabeledInput
                label="SF of steel deck replaced to date."
                value={visit.unit_qty_deck_replaced_sf}
                onChange={(v) => handleVisitFieldChange("unit_qty_deck_replaced_sf", parseInt(v) || 0)}
                type="number"
                min={0}
              />
            </div>
          </div>

          {/* General Notes */}
          <div>
            <SectionLabel>General Notes</SectionLabel>
            <Textarea
              className="bg-slate-900 border-slate-600 text-slate-100 min-h-[120px] resize-y"
              value={visit.general_notes || ""}
              onChange={(e) => handleVisitFieldChange("general_notes", e.target.value || null)}
              readOnly={isSubmitted}
              placeholder="General notes about this visit..."
            />
          </div>

          {/* SRC Associate */}
          <div>
            <SectionLabel>SRC Associate</SectionLabel>
            {srcAssociate ? (
              <div className="rounded-lg bg-slate-800 border border-slate-700/50 p-3">
                <p className="text-sm font-semibold text-slate-100">{srcAssociate.full_name}</p>
                {srcAssociate.phone && <p className="text-xs text-slate-400">Phone: {srcAssociate.phone}</p>}
                <p className="text-xs text-slate-400">Email: {srcAssociate.email}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">No associate assigned.</p>
            )}
          </div>

          {/* CC List */}
          {ccList.length > 0 && (
            <div>
              <SectionLabel>CC List</SectionLabel>
              <div className="rounded-lg bg-slate-800 border border-slate-700/50 p-3 space-y-1">
                {ccList.map((entry: any, i: number) => (
                  <p key={i} className="text-sm text-slate-300">
                    {entry.names || entry.name || ""}{entry.org ? `; ${entry.org}` : ""}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Internal Notes */}
          <div className="pt-2">
            <Separator className="bg-slate-700/50 mb-4" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">
              Notes to Proofer / Internal Notes
            </p>
            <p className="text-[10px] text-slate-600 mb-2 italic">Not shown on report</p>
            <Textarea
              className="bg-slate-950 border-slate-700 text-slate-400 min-h-[100px] resize-y"
              value={visit.internal_notes || ""}
              onChange={(e) => handleVisitFieldChange("internal_notes", e.target.value || null)}
              readOnly={isSubmitted}
              placeholder="Internal notes (not included in client report)..."
            />
          </div>
        </div>
      );
    }

    // PHOTO GRID step (last step)
    return (
      <div className="space-y-4">
        {photos.length === 0 && !uploading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Camera className="h-12 w-12 text-slate-700 mb-3" />
            <p className="text-sm text-slate-500">No photos yet. Tap Add Photo to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Table header */}
            <div className="grid grid-cols-[40px_60px_1fr_88px] gap-2 items-center px-1">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">#</span>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Photo</span>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Description</span>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold text-right">Actions</span>
            </div>

            {photos.map((photo, idx) => (
              <div
                key={photo.id}
                className="grid grid-cols-[40px_60px_1fr_88px] gap-2 items-center bg-slate-800 border border-slate-700/50 rounded-lg px-2 py-2"
              >
                {/* Photo # */}
                <span className="text-sm font-semibold text-slate-100 text-center">
                  {photo.photo_number}
                </span>

                {/* Thumbnail */}
                <button
                  className="w-[60px] h-[60px] rounded-md overflow-hidden bg-slate-700 shrink-0"
                  onClick={() => setPreviewIndex(idx)}
                >
                  <img
                    src={photo.public_url}
                    alt={`Photo ${photo.photo_number}`}
                    className="w-full h-full object-cover"
                  />
                </button>

                {/* Description */}
                <div className="space-y-0.5">
                  {photo.label && (
                    <span className="inline-block text-[10px] font-medium uppercase tracking-wider text-teal-400 bg-teal-500/10 rounded px-1.5 py-0.5">
                      {photo.label}
                    </span>
                  )}
                  <Input
                    className="bg-slate-900 border-slate-600 text-slate-100 text-xs h-9"
                    value={photo.description || ""}
                    onChange={(e) => handlePhotoDescChange(photo.id, e.target.value)}
                    placeholder="Add description..."
                    readOnly={isSubmitted}
                  />
                </div>

                {/* Actions */}
                {!isSubmitted && (
                  <div className="flex items-center justify-end gap-1">
                    <button
                      className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 disabled:opacity-30"
                      disabled={idx === 0}
                      onClick={() => handleReorder(idx, "up")}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 disabled:opacity-30"
                      disabled={idx === photos.length - 1}
                      onClick={() => handleReorder(idx, "down")}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      className="p-1.5 rounded text-red-400 hover:text-red-300 hover:bg-red-900/30"
                      onClick={() => setDeletePhotoId(photo.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Upload progress row */}
        {uploading && (
          <div className="flex items-center gap-3 bg-slate-800 border border-slate-700/50 rounded-lg px-4 py-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-slate-300">Uploading photo...</span>
          </div>
        )}

        {/* Add Photo button */}
        {!isSubmitted && (
          <Button
            className="w-full min-h-[44px] bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => photoInputRef.current?.click()}
            disabled={uploading}
          >
            <Camera className="h-4 w-4 mr-2" /> Add Photo
          </Button>
        )}

        {/* Hidden file input */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    );
  };

  const progressPct = totalSteps > 1 ? ((currentStep + 1) / totalSteps) * 100 : 100;

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
        <div className="flex items-center gap-2">
          {/* + shortcut on photo step only */}
          {isPhotoStep && !isSubmitted && (
            <button
              onClick={() => photoInputRef.current?.click()}
              className="p-2 rounded-md text-primary hover:bg-slate-700/50"
              aria-label="Add photo"
              disabled={uploading}
            >
              <Plus className="h-5 w-5" />
            </button>
          )}
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
        {isLastStep && !isSubmitted ? (
          <Button
            className="min-h-[44px] bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={handleSubmitVisit}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Submit Visit
          </Button>
        ) : isLastStep && isSubmitted ? (
          <Button
            className="min-h-[44px] bg-slate-700 text-slate-400 cursor-not-allowed"
            disabled
          >
            Submitted
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

      {/* === FAB — floating camera button === */}
      {!isSubmitted && (
        <button
          onClick={() => setFabSheetOpen(true)}
          className="fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full bg-teal-600 hover:bg-teal-700 shadow-lg flex items-center justify-center transition-colors"
          aria-label="Add photo"
        >
          <Camera className="h-6 w-6 text-white" />
        </button>
      )}

      {/* FAB bottom sheet */}
      <Sheet open={fabSheetOpen} onOpenChange={setFabSheetOpen}>
        <SheetContent side="bottom" className="bg-slate-900 border-slate-700 rounded-t-2xl px-4 pb-8 pt-4">
          <SheetHeader className="pb-3">
            <SheetTitle className="text-slate-100 text-sm font-bold">Add Photo</SheetTitle>
          </SheetHeader>
          <div className="space-y-2">
            <button
              className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-lg bg-slate-800 border border-slate-700/50 hover:bg-slate-700/60 transition-colors min-h-[48px]"
              onClick={() => takePhotoRef.current?.click()}
            >
              <Camera className="h-5 w-5 text-teal-400" />
              <span className="text-sm font-medium text-slate-100">Take Photo</span>
            </button>
            <button
              className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-lg bg-slate-800 border border-slate-700/50 hover:bg-slate-700/60 transition-colors min-h-[48px]"
              onClick={() => uploadPhotoRef.current?.click()}
            >
              <ImagePlus className="h-5 w-5 text-teal-400" />
              <span className="text-sm font-medium text-slate-100">Upload from Camera Roll</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Hidden FAB file inputs */}
      <input
        ref={takePhotoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFabFileSelect}
      />
      <input
        ref={uploadPhotoRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFabFileSelect}
      />

      {/* Label modal */}
      <Dialog open={labelModalOpen} onOpenChange={(open) => {
        if (!open && !fabUploading) {
          setLabelModalOpen(false);
          setCurrentLabelFile(null);
          setLabelQueue([]);
        }
      }}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-100 text-sm">
              Label Photo{labelQueue.length > 0 ? ` (${labelQueue.length + 1} remaining)` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Label select */}
            <div className="space-y-1">
              <label className="text-xs text-slate-300 font-medium">Label</label>
              <Select value={selectedLabel} onValueChange={setSelectedLabel}>
                <SelectTrigger className="bg-slate-900 border-slate-600 text-slate-100">
                  <SelectValue placeholder="Select label..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {allLabelOptions.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                  <SelectItem value="__new__">+ New Label</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* New label input */}
            {selectedLabel === "__new__" && (
              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">New Label</label>
                <Input
                  className="bg-slate-900 border-slate-600 text-slate-100"
                  value={newLabelText}
                  onChange={(e) => setNewLabelText(e.target.value)}
                  placeholder="Type new label..."
                  autoFocus
                />
              </div>
            )}

            {/* Note input */}
            <div className="space-y-1">
              <label className="text-xs text-slate-300 font-medium">Note</label>
              <Input
                className="bg-slate-900 border-slate-600 text-slate-100"
                value={photoNote}
                onChange={(e) => setPhotoNote(e.target.value)}
                placeholder="Add a note..."
              />
            </div>
          </div>
          <DialogFooter className="flex flex-row gap-2 sm:gap-2">
            <Button
              variant="outline"
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700/50 min-h-[44px]"
              onClick={() => handleLabelSave(true)}
              disabled={fabUploading}
            >
              Skip
            </Button>
            <Button
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white min-h-[44px]"
              onClick={() => handleLabelSave(false)}
              disabled={fabUploading || (selectedLabel === "__new__" && !newLabelText.trim())}
            >
              {fabUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Full-screen photo preview overlay */}
      {previewIndex !== null && photos[previewIndex] && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center">
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 text-slate-200 hover:bg-slate-700"
            onClick={() => setPreviewIndex(null)}
          >
            <X className="h-6 w-6" />
          </button>

          {previewIndex > 0 && (
            <button
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-800/80 text-slate-200 hover:bg-slate-700"
              onClick={() => setPreviewIndex(previewIndex - 1)}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          <img
            src={photos[previewIndex].public_url}
            alt={`Photo ${photos[previewIndex].photo_number}`}
            className="max-h-[85vh] max-w-[90vw] object-contain rounded"
          />

          {previewIndex < photos.length - 1 && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-800/80 text-slate-200 hover:bg-slate-700"
              onClick={() => setPreviewIndex(previewIndex + 1)}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          <div className="absolute bottom-6 text-center text-sm text-slate-400">
            Photo {photos[previewIndex].photo_number} of {photos.length}
            {photos[previewIndex].label && (
              <p className="mt-0.5 text-teal-400 text-xs">{photos[previewIndex].label}</p>
            )}
            {photos[previewIndex].description && (
              <p className="mt-1 text-slate-300">{photos[previewIndex].description}</p>
            )}
          </div>
        </div>
      )}

      {/* Delete photo confirm dialog */}
      <AlertDialog open={!!deletePhotoId} onOpenChange={(open) => !open && setDeletePhotoId(null)}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">
              Delete photo #{photos.find((p) => p.id === deletePhotoId)?.photo_number}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Cannot be undone. The photo will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-600 text-slate-300 hover:bg-slate-700/50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={confirmDeletePhoto}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Submit visit confirm dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">
              Submit Visit #{visit.visit_number}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This cannot be undone. The visit will be locked for editing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-600 text-slate-300 hover:bg-slate-700/50">
              Go Back
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={confirmSubmit}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Visit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
