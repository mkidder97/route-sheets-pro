import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { differenceInCalendarDays, format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  CalendarIcon,
  Check,
  ChevronsUpDown,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Loader2,
  ArrowLeft,
  ArrowRight,
  X,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────
interface Contact {
  name_title: string;
  phone: string;
  email: string;
}
interface CCEntry {
  names: string;
  org: string;
}
interface ChecklistSection {
  title: string;
  items: string[];
}
interface FormData {
  building_id: string;
  project_name: string;
  ri_number: string;
  membrane_type: string;
  contract_start_date: Date | undefined;
  contract_completion_date: Date | undefined;
  total_contract_days: string;
  status: string;
  owner_company: string;
  owner_address: string;
  owner_city_state_zip: string;
  owner_contacts: Contact[];
  contractor_name: string;
  contractor_contacts: Contact[];
  cc_list: CCEntry[];
  sections: ChecklistSection[];
}

const STEP_LABELS = ["Project Info", "Owner", "Contractor", "CC List", "Checklist"];

const emptyContact = (): Contact => ({ name_title: "", phone: "", email: "" });
const emptyCCEntry = (): CCEntry => ({ names: "", org: "" });
const emptySection = (): ChecklistSection => ({ title: "", items: [""] });

const initialForm: FormData = {
  building_id: "",
  project_name: "",
  ri_number: "",
  membrane_type: "",
  contract_start_date: undefined,
  contract_completion_date: undefined,
  total_contract_days: "",
  status: "active",
  owner_company: "",
  owner_address: "",
  owner_city_state_zip: "",
  owner_contacts: [emptyContact()],
  contractor_name: "",
  contractor_contacts: [emptyContact()],
  cc_list: [emptyCCEntry()],
  sections: [emptySection()],
};

// ── Component ──────────────────────────────────────────────────────
export default function CMProjectNew() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(initialForm);
  const [submitting, setSubmitting] = useState(false);

  // Building search
  const [buildingOpen, setBuildingOpen] = useState(false);
  const [buildingSearch, setBuildingSearch] = useState("");
  const [buildings, setBuildings] = useState<
    { id: string; property_name: string; address: string; city: string; state: string }[]
  >([]);
  const [selectedBuildingLabel, setSelectedBuildingLabel] = useState("");

  // Date picker open states
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  // Fetch buildings on search
  useEffect(() => {
    const fetchBuildings = async () => {
      let q = supabase
        .from("buildings")
        .select("id, property_name, address, city, state")
        .eq("is_deleted", false)
        .order("property_name")
        .limit(50);
      if (buildingSearch.trim()) {
        q = q.or(
          `property_name.ilike.%${buildingSearch}%,address.ilike.%${buildingSearch}%`
        );
      }
      const { data } = await q;
      if (data) setBuildings(data);
    };
    fetchBuildings();
  }, [buildingSearch]);

  // Auto-calculate contract days
  useEffect(() => {
    if (form.contract_start_date && form.contract_completion_date) {
      const days = differenceInCalendarDays(
        form.contract_completion_date,
        form.contract_start_date
      );
      if (days >= 0) {
        setForm((f) => ({ ...f, total_contract_days: String(days) }));
      }
    }
  }, [form.contract_start_date, form.contract_completion_date]);

  // ── Helpers ────────────────────────────────────────────────────
  const updateForm = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) =>
      setForm((f) => ({ ...f, [key]: value })),
    []
  );

  const updateContact = (
    listKey: "owner_contacts" | "contractor_contacts",
    idx: number,
    field: keyof Contact,
    value: string
  ) => {
    setForm((f) => {
      const list = [...f[listKey]];
      list[idx] = { ...list[idx], [field]: value };
      return { ...f, [listKey]: list };
    });
  };

  const addContact = (listKey: "owner_contacts" | "contractor_contacts") =>
    setForm((f) => ({ ...f, [listKey]: [...f[listKey], emptyContact()] }));

  const removeContact = (listKey: "owner_contacts" | "contractor_contacts", idx: number) =>
    setForm((f) => ({
      ...f,
      [listKey]: f[listKey].filter((_, i) => i !== idx),
    }));

  const updateCC = (idx: number, field: keyof CCEntry, value: string) => {
    setForm((f) => {
      const list = [...f.cc_list];
      list[idx] = { ...list[idx], [field]: value };
      return { ...f, cc_list: list };
    });
  };

  const addCC = () => setForm((f) => ({ ...f, cc_list: [...f.cc_list, emptyCCEntry()] }));
  const removeCC = (idx: number) =>
    setForm((f) => ({ ...f, cc_list: f.cc_list.filter((_, i) => i !== idx) }));

  const updateSectionTitle = (idx: number, title: string) => {
    setForm((f) => {
      const s = [...f.sections];
      s[idx] = { ...s[idx], title };
      return { ...f, sections: s };
    });
  };

  const updateSectionItem = (sIdx: number, iIdx: number, value: string) => {
    setForm((f) => {
      const s = [...f.sections];
      const items = [...s[sIdx].items];
      items[iIdx] = value;
      s[sIdx] = { ...s[sIdx], items };
      return { ...f, sections: s };
    });
  };

  const addSectionItem = (sIdx: number) => {
    setForm((f) => {
      const s = [...f.sections];
      s[sIdx] = { ...s[sIdx], items: [...s[sIdx].items, ""] };
      return { ...f, sections: s };
    });
  };

  const removeSectionItem = (sIdx: number, iIdx: number) => {
    setForm((f) => {
      const s = [...f.sections];
      s[sIdx] = { ...s[sIdx], items: s[sIdx].items.filter((_, i) => i !== iIdx) };
      return { ...f, sections: s };
    });
  };

  const addSection = () =>
    setForm((f) => ({ ...f, sections: [...f.sections, emptySection()] }));

  const removeSection = (idx: number) =>
    setForm((f) => ({ ...f, sections: f.sections.filter((_, i) => i !== idx) }));

  const moveSection = (idx: number, dir: -1 | 1) => {
    setForm((f) => {
      const s = [...f.sections];
      const target = idx + dir;
      if (target < 0 || target >= s.length) return f;
      [s[idx], s[target]] = [s[target], s[idx]];
      return { ...f, sections: s };
    });
  };

  // ── Validation ─────────────────────────────────────────────────
  const validate = (): boolean => {
    switch (step) {
      case 1:
        if (!form.building_id) { toast.error("Please select a building."); return false; }
        if (!form.project_name.trim()) { toast.error("Project name is required."); return false; }
        return true;
      case 2:
        if (!form.owner_contacts.some((c) => c.name_title.trim())) {
          toast.error("At least one owner contact with a name is required.");
          return false;
        }
        return true;
      case 3:
        if (!form.contractor_contacts.some((c) => c.name_title.trim())) {
          toast.error("At least one contractor contact with a name is required.");
          return false;
        }
        return true;
      case 4:
        if (!form.cc_list.some((c) => c.names.trim())) {
          toast.error("At least one CC entry with names is required.");
          return false;
        }
        return true;
      case 5:
        if (!form.sections.some((s) => s.title.trim() && s.items.some((i) => i.trim()))) {
          toast.error("At least one section with a title and one item is required.");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!validate()) return;
    setStep((s) => Math.min(s + 1, 5));
  };

  // ── Submit ─────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: project, error: projError } = await supabase
        .from("cm_projects")
        .insert({
          building_id: form.building_id,
          project_name: form.project_name.trim(),
          ri_number: form.ri_number.trim() || null,
          membrane_type: form.membrane_type.trim() || null,
          contract_start_date: form.contract_start_date
            ? format(form.contract_start_date, "yyyy-MM-dd")
            : null,
          contract_completion_date: form.contract_completion_date
            ? format(form.contract_completion_date, "yyyy-MM-dd")
            : null,
          total_contract_days: form.total_contract_days
            ? parseInt(form.total_contract_days, 10)
            : null,
          status: form.status,
          owner_company: form.owner_company.trim() || null,
          owner_address: form.owner_address.trim() || null,
          owner_city_state_zip: form.owner_city_state_zip.trim() || null,
          owner_contacts: form.owner_contacts.filter((c) => c.name_title.trim()) as unknown as Json,
          contractor_contacts: form.contractor_contacts.filter((c) => c.name_title.trim()) as unknown as Json,
          cc_list: form.cc_list.filter((c) => c.names.trim()) as unknown as Json,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();

      if (projError) throw projError;

      const sectionsToInsert = form.sections
        .filter((s) => s.title.trim())
        .map((s, idx) => ({
          cm_project_id: project!.id,
          section_title: s.title.trim(),
          checklist_items: s.items.filter((i) => i.trim()),
          sort_order: idx,
        }));

      if (sectionsToInsert.length > 0) {
        const { error: secError } = await supabase
          .from("cm_project_sections")
          .insert(sectionsToInsert);
        if (secError) throw secError;
      }

      toast.success("Project created successfully!");
      navigate(`/field/cm/${project!.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create project.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Input class ────────────────────────────────────────────────
  const inputCls =
    "bg-slate-900 border-slate-600 text-slate-100 placeholder:text-slate-500 h-11";
  const labelCls = "text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1.5";
  const cardCls = "rounded-xl bg-slate-800 border border-slate-700/50 p-5 space-y-4";

  // ── Step Indicator ─────────────────────────────────────────────
  const StepIndicator = () => (
    <div className="flex items-center justify-between mb-6 px-2">
      {STEP_LABELS.map((label, i) => {
        const num = i + 1;
        const isCompleted = num < step;
        const isCurrent = num === step;
        return (
          <div key={num} className="flex flex-col items-center flex-1 relative">
            {i > 0 && (
              <div
                className={cn(
                  "absolute top-4 -left-1/2 w-full h-0.5",
                  isCompleted ? "bg-blue-600" : "bg-slate-700"
                )}
              />
            )}
            <div
              className={cn(
                "relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors",
                isCompleted
                  ? "bg-blue-600 border-blue-600 text-white"
                  : isCurrent
                  ? "border-blue-600 text-blue-400 bg-slate-900"
                  : "border-slate-700 text-slate-500 bg-slate-900"
              )}
            >
              {isCompleted ? <Check className="h-4 w-4" /> : num}
            </div>
            <span
              className={cn(
                "text-[10px] mt-1.5 font-medium tracking-wide",
                isCurrent ? "text-blue-400" : isCompleted ? "text-slate-300" : "text-slate-500"
              )}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );

  // ── Contact List Component ─────────────────────────────────────
  const ContactList = ({
    contacts,
    listKey,
  }: {
    contacts: Contact[];
    listKey: "owner_contacts" | "contractor_contacts";
  }) => (
    <div className="space-y-3">
      {contacts.map((c, idx) => (
        <div key={idx} className="rounded-lg bg-slate-900 border border-slate-700/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Contact {idx + 1}
            </span>
            {contacts.length > 1 && (
              <button
                type="button"
                onClick={() => removeContact(listKey, idx)}
                disabled={submitting}
                className="text-red-400 hover:text-red-300 p-1"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <Input
            placeholder="Name, Title (e.g. David Given, Construction Manager)"
            value={c.name_title}
            onChange={(e) => updateContact(listKey, idx, "name_title", e.target.value)}
            disabled={submitting}
            className={inputCls}
            maxLength={200}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Phone"
              value={c.phone}
              onChange={(e) => updateContact(listKey, idx, "phone", e.target.value)}
              disabled={submitting}
              className={inputCls}
              maxLength={30}
            />
            <Input
              placeholder="Email"
              type="email"
              value={c.email}
              onChange={(e) => updateContact(listKey, idx, "email", e.target.value)}
              disabled={submitting}
              className={inputCls}
              maxLength={100}
            />
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="border-slate-600 text-slate-300 hover:bg-slate-700/50 h-11"
        onClick={() => addContact(listKey)}
        disabled={submitting}
      >
        <Plus className="h-4 w-4 mr-1.5" /> Add Contact
      </Button>
    </div>
  );

  // ── Render Steps ───────────────────────────────────────────────
  const renderStep1 = () => (
    <div className={cardCls}>
      <div>
        <label className={labelCls}>Building *</label>
        <Popover open={buildingOpen} onOpenChange={setBuildingOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={buildingOpen}
              className={cn(
                "w-full justify-between h-11 border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800",
                !form.building_id && "text-slate-500"
              )}
              disabled={submitting}
            >
              {selectedBuildingLabel || "Search buildings..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0 bg-slate-800 border-slate-700" align="start">
            <Command className="bg-slate-800">
              <CommandInput
                placeholder="Type to search..."
                value={buildingSearch}
                onValueChange={setBuildingSearch}
                className="text-slate-100"
              />
              <CommandList>
                <CommandEmpty className="text-slate-400 text-sm py-4 text-center">
                  No buildings found.
                </CommandEmpty>
                <CommandGroup>
                  {buildings.map((b) => (
                    <CommandItem
                      key={b.id}
                      value={`${b.property_name} ${b.address}`}
                      onSelect={() => {
                        updateForm("building_id", b.id);
                        setSelectedBuildingLabel(b.property_name);
                        setBuildingOpen(false);
                      }}
                      className="text-slate-200 hover:bg-slate-700"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          form.building_id === b.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">{b.property_name}</span>
                        <span className="text-xs text-slate-400">
                          {b.address}, {b.city}, {b.state}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <label className={labelCls}>Project Name *</label>
        <Input
          value={form.project_name}
          onChange={(e) => updateForm("project_name", e.target.value)}
          disabled={submitting}
          className={inputCls}
          placeholder="e.g. Main Warehouse Roof Replacement"
          maxLength={200}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>RI / Project Number</label>
          <Input
            value={form.ri_number}
            onChange={(e) => updateForm("ri_number", e.target.value)}
            disabled={submitting}
            className={inputCls}
            placeholder="e.g. RI-2025-042"
            maxLength={50}
          />
        </div>
        <div>
          <label className={labelCls}>Membrane Type</label>
          <Input
            value={form.membrane_type}
            onChange={(e) => updateForm("membrane_type", e.target.value)}
            disabled={submitting}
            className={inputCls}
            placeholder="e.g. TPO 60-mil Fleeceback"
            maxLength={100}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Contract Start Date</label>
          <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start h-11 border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800",
                  !form.contract_start_date && "text-slate-500"
                )}
                disabled={submitting}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {form.contract_start_date
                  ? format(form.contract_start_date, "MMM d, yyyy")
                  : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700" align="start">
              <Calendar
                mode="single"
                selected={form.contract_start_date}
                onSelect={(d) => {
                  updateForm("contract_start_date", d);
                  setStartDateOpen(false);
                }}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <label className={labelCls}>Contract Completion Date</label>
          <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start h-11 border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800",
                  !form.contract_completion_date && "text-slate-500"
                )}
                disabled={submitting}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {form.contract_completion_date
                  ? format(form.contract_completion_date, "MMM d, yyyy")
                  : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700" align="start">
              <Calendar
                mode="single"
                selected={form.contract_completion_date}
                onSelect={(d) => {
                  updateForm("contract_completion_date", d);
                  setEndDateOpen(false);
                }}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Total Contract Days</label>
          <Input
            type="number"
            value={form.total_contract_days}
            onChange={(e) => updateForm("total_contract_days", e.target.value)}
            disabled={submitting}
            className={inputCls}
            placeholder="Auto-calculated"
            min={0}
          />
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <Select
            value={form.status}
            onValueChange={(v) => updateForm("status", v)}
            disabled={submitting}
          >
            <SelectTrigger className={cn(inputCls, "w-full")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className={cardCls}>
      <div>
        <label className={labelCls}>Owner Company</label>
        <Input
          value={form.owner_company}
          onChange={(e) => updateForm("owner_company", e.target.value)}
          disabled={submitting}
          className={inputCls}
          maxLength={200}
        />
      </div>
      <div>
        <label className={labelCls}>Owner Address</label>
        <Input
          value={form.owner_address}
          onChange={(e) => updateForm("owner_address", e.target.value)}
          disabled={submitting}
          className={inputCls}
          maxLength={200}
        />
      </div>
      <div>
        <label className={labelCls}>Owner City, State, ZIP</label>
        <Input
          value={form.owner_city_state_zip}
          onChange={(e) => updateForm("owner_city_state_zip", e.target.value)}
          disabled={submitting}
          className={inputCls}
          placeholder="e.g. Dallas, TX 75201"
          maxLength={100}
        />
      </div>
      <div>
        <label className={labelCls}>Owner Contacts *</label>
        <ContactList contacts={form.owner_contacts} listKey="owner_contacts" />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className={cardCls}>
      <div>
        <label className={labelCls}>Contractor Name</label>
        <Input
          value={form.contractor_name}
          onChange={(e) => updateForm("contractor_name", e.target.value)}
          disabled={submitting}
          className={inputCls}
          placeholder="e.g. ABC Roofing Co."
          maxLength={200}
        />
      </div>
      <div>
        <label className={labelCls}>Contractor Contacts *</label>
        <ContactList contacts={form.contractor_contacts} listKey="contractor_contacts" />
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className={cardCls}>
      <p className="text-xs text-slate-400 mb-2">
        These names appear on every report in the cc: field. Each group is displayed as
        &quot;[Names]; [Organization]&quot;.
      </p>
      <div className="space-y-3">
        {form.cc_list.map((cc, idx) => (
          <div key={idx} className="rounded-lg bg-slate-900 border border-slate-700/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                CC Group {idx + 1}
              </span>
              {form.cc_list.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCC(idx)}
                  disabled={submitting}
                  className="text-red-400 hover:text-red-300 p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <Input
              placeholder="Names (e.g. David Given, Cristina Smith)"
              value={cc.names}
              onChange={(e) => updateCC(idx, "names", e.target.value)}
              disabled={submitting}
              className={inputCls}
              maxLength={300}
            />
            <Input
              placeholder="Organization (e.g. REALTY)"
              value={cc.org}
              onChange={(e) => updateCC(idx, "org", e.target.value)}
              disabled={submitting}
              className={inputCls}
              maxLength={100}
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="border-slate-600 text-slate-300 hover:bg-slate-700/50 h-11"
          onClick={addCC}
          disabled={submitting}
        >
          <Plus className="h-4 w-4 mr-1.5" /> Add CC Group
        </Button>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className={cardCls}>
      <p className="text-xs text-slate-400 mb-2">
        Configure the inspection checklist template for this project. These sections will
        appear on every site visit.
      </p>
      <div className="space-y-4">
        {form.sections.map((sec, sIdx) => (
          <div key={sIdx} className="rounded-lg bg-slate-900 border border-slate-700/50 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Section Title (e.g. GROUND CONDITIONS & SET-UP)"
                value={sec.title}
                onChange={(e) => updateSectionTitle(sIdx, e.target.value)}
                disabled={submitting}
                className={cn(inputCls, "flex-1")}
                maxLength={200}
              />
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => moveSection(sIdx, -1)}
                  disabled={submitting || sIdx === 0}
                  className="text-slate-400 hover:text-slate-200 disabled:opacity-30 p-0.5"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(sIdx, 1)}
                  disabled={submitting || sIdx === form.sections.length - 1}
                  className="text-slate-400 hover:text-slate-200 disabled:opacity-30 p-0.5"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              {form.sections.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSection(sIdx)}
                  disabled={submitting}
                  className="text-red-400 hover:text-red-300 p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            {sec.items.map((item, iIdx) => (
              <div key={iIdx} className="flex items-center gap-2 pl-4">
                <span className="text-xs text-slate-500 w-5 text-right">{iIdx + 1}.</span>
                <Input
                  placeholder="Checklist item"
                  value={item}
                  onChange={(e) => updateSectionItem(sIdx, iIdx, e.target.value)}
                  disabled={submitting}
                  className={cn(inputCls, "flex-1")}
                  maxLength={300}
                />
                {sec.items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSectionItem(sIdx, iIdx)}
                    disabled={submitting}
                    className="text-red-400 hover:text-red-300 p-1"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-slate-200 ml-4"
              onClick={() => addSectionItem(sIdx)}
              disabled={submitting}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="border-slate-600 text-slate-300 hover:bg-slate-700/50 h-11"
          onClick={addSection}
          disabled={submitting}
        >
          <Plus className="h-4 w-4 mr-1.5" /> Add Section
        </Button>
      </div>
    </div>
  );

  // ── Main Render ────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-slate-900 p-4 max-w-2xl mx-auto">
      <h1 className="text-lg font-bold text-slate-100 mb-4">New CM Project</h1>

      <StepIndicator />

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
      {step === 5 && renderStep5()}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between mt-6 gap-3">
        <Button
          type="button"
          variant="ghost"
          className="text-slate-400 hover:text-slate-200 h-11"
          onClick={() => navigate("/field/cm")}
          disabled={submitting}
        >
          Cancel
        </Button>
        <div className="flex gap-3">
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-700/50 h-11"
              onClick={() => setStep((s) => s - 1)}
              disabled={submitting}
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
            </Button>
          )}
          {step < 5 ? (
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700 text-white h-11 px-6"
              onClick={handleNext}
              disabled={submitting}
            >
              Next <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          ) : (
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700 text-white h-11 px-6"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...
                </>
              ) : (
                "Create Project"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
