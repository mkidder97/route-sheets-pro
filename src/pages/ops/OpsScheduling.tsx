import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import {
  addMonths, subMonths, addWeeks, subWeeks,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay,
  parseISO, differenceInCalendarDays,
  addDays,
} from "date-fns";
import {
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Plus, Filter, Trash2, AlertTriangle, Upload,
} from "lucide-react";
import { ScheduleUpload } from "@/components/ScheduleUpload";
import {
  DndContext, DragEndEvent, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

// ─── Constants ──────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  { key: "annuals", label: "Annuals", color: "#3498DB" },
  { key: "cm_job", label: "CM Job", color: "#27AE60" },
  { key: "other_visit", label: "Other Visit", color: "#9B59B6" },
  { key: "pto", label: "PTO", color: "#E74C3C" },
  { key: "travel", label: "Travel", color: "#E67E22" },
  { key: "office", label: "Office", color: "#95A5A6" },
] as const;

const eventColor = (type: string, override?: string | null) =>
  override || EVENT_TYPES.find((e) => e.key === type)?.color || "#94a3b8";

// ─── Types ──────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string;
  title: string;
  event_type: string;
  start_date: string;
  end_date: string;
  inspector_id: string | null;
  inspector_name?: string;
  color: string | null;
  notes: string | null;
  reference_type: string | null;
  reference_id: string | null;
  user_id: string | null;
  created_by: string | null;
  virtual?: boolean;
}

// ─── Conflict detection helper ──────────────────────────────────────────────

function findConflicts(
  inspectorId: string | null,
  startDate: string,
  endDate: string,
  allEvents: CalendarEvent[],
  excludeEventId?: string,
): CalendarEvent[] {
  if (!inspectorId || !startDate) return [];
  const end = endDate || startDate;
  return allEvents.filter(
    (e) =>
      e.inspector_id === inspectorId &&
      e.id !== excludeEventId &&
      e.start_date <= end &&
      (e.end_date ?? e.start_date) >= startDate,
  );
}

// ─── Data hooks ─────────────────────────────────────────────────────────────

const STALE = 30_000;

function useInspectors() {
  return useQuery({
    queryKey: ["sched-inspectors"],
    staleTime: STALE,
    queryFn: async () => {
      const { data } = await supabase.from("inspectors").select("id, name").order("name");
      return data ?? [];
    },
  });
}

function useSchedulingEvents(rangeStart: string, rangeEnd: string) {
  return useQuery({
    queryKey: ["sched-events", rangeStart, rangeEnd],
    staleTime: STALE,
    queryFn: async () => {
      const { data } = await supabase
        .from("scheduling_events")
        .select("*, inspectors:inspector_id(name)")
        .or(`start_date.lte.${rangeEnd},end_date.gte.${rangeStart}`)
        .order("start_date");
      return (data ?? []).map((e: any) => ({
        id: e.id,
        title: e.title,
        event_type: e.event_type,
        start_date: e.start_date,
        end_date: e.end_date ?? e.start_date,
        inspector_id: e.inspector_id,
        inspector_name: e.inspectors?.name ?? undefined,
        color: e.color,
        notes: e.notes,
        reference_type: e.reference_type,
        reference_id: e.reference_id,
        user_id: e.user_id,
        created_by: e.created_by,
      })) as CalendarEvent[];
    },
  });
}

function useDerivedEvents(rangeStart: string, rangeEnd: string) {
  const routePlanDays = useQuery({
    queryKey: ["sched-route-days", rangeStart, rangeEnd],
    staleTime: STALE,
    queryFn: async () => {
      const { data } = await supabase
        .from("route_plan_days")
        .select(`
          id, day_date,
          route_plans!inner(id, name, status, inspector_id,
            regions:region_id(name),
            inspectors:inspector_id(name)
          )
        `)
        .gte("day_date", rangeStart)
        .lte("day_date", rangeEnd);
      return data ?? [];
    },
  });

  const dayIds = (routePlanDays.data ?? []).map((d: any) => d.id);
  const buildingCounts = useQuery({
    queryKey: ["sched-route-bldg-counts", dayIds],
    staleTime: STALE,
    enabled: dayIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("route_plan_buildings")
        .select("route_plan_day_id")
        .in("route_plan_day_id", dayIds);
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        counts[r.route_plan_day_id] = (counts[r.route_plan_day_id] ?? 0) + 1;
      });
      return counts;
    },
  });

  const cmJobs = useQuery({
    queryKey: ["sched-cm-jobs", rangeStart, rangeEnd],
    staleTime: STALE,
    queryFn: async () => {
      const { data } = await supabase
        .from("cm_jobs")
        .select("id, title, address, scheduled_date, assigned_to")
        .not("scheduled_date", "is", null)
        .gte("scheduled_date", rangeStart)
        .lte("scheduled_date", rangeEnd);
      return data ?? [];
    },
  });

  const derived = useMemo<CalendarEvent[]>(() => {
    const events: CalendarEvent[] = [];
    (routePlanDays.data ?? []).forEach((d: any) => {
      const rp = d.route_plans as any;
      if (!rp || rp.status === "archived") return;
      const regionName = rp.regions?.name ?? "";
      const bldgCount = buildingCounts.data?.[d.id] ?? 0;
      events.push({
        id: `rpd-${d.id}`,
        title: `Annuals ${regionName} — ${bldgCount} bldgs`,
        event_type: "annuals",
        start_date: d.day_date,
        end_date: d.day_date,
        inspector_id: rp.inspector_id,
        inspector_name: rp.inspectors?.name,
        color: null,
        notes: null,
        reference_type: "route_plan",
        reference_id: rp.id,
        user_id: null,
        created_by: null,
        virtual: true,
      });
    });
    (cmJobs.data ?? []).forEach((j: any) => {
      events.push({
        id: `cmj-${j.id}`,
        title: j.title,
        event_type: "cm_job",
        start_date: j.scheduled_date,
        end_date: j.scheduled_date,
        inspector_id: null,
        color: null,
        notes: j.address ?? null,
        reference_type: "cm_job",
        reference_id: j.id,
        user_id: j.assigned_to,
        created_by: null,
        virtual: true,
      });
    });
    return events;
  }, [routePlanDays.data, buildingCounts.data, cmJobs.data]);

  return { derived, isLoading: routePlanDays.isLoading || cmJobs.isLoading };
}

// ─── CM Jobs search hook ────────────────────────────────────────────────────

function useCmJobsSearch(search: string, enabled: boolean) {
  return useQuery({
    queryKey: ["sched-cm-search", search],
    staleTime: STALE,
    enabled: enabled && search.length >= 1,
    queryFn: async () => {
      const { data } = await supabase
        .from("cm_jobs")
        .select("id, title, address")
        .ilike("title", `%${search}%`)
        .neq("status", "complete")
        .limit(20);
      return data ?? [];
    },
  });
}

// ─── Event Dialog ───────────────────────────────────────────────────────────

interface EventDialogProps {
  open: boolean;
  onClose: () => void;
  event: CalendarEvent | null;
  defaultDate?: string;
  inspectors: { id: string; name: string }[];
  allEvents: CalendarEvent[];
  isManager: boolean;
}

function EventDialog({ open, onClose, event, defaultDate, inspectors, allEvents, isManager }: EventDialogProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isEdit = !!event && !event.virtual;
  const readOnly = !isManager || event?.virtual;

  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<string>("other_visit");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [inspectorId, setInspectorId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [linkedCmJobId, setLinkedCmJobId] = useState<string>("");
  const [cmSearch, setCmSearch] = useState("");
  const [cmDropdownOpen, setCmDropdownOpen] = useState(false);

  const { data: cmSearchResults = [] } = useCmJobsSearch(cmSearch, eventType === "cm_job");

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (event && !event.virtual) {
        setTitle(event.title);
        setEventType(event.event_type);
        setStartDate(event.start_date);
        setEndDate(event.end_date ?? event.start_date);
        setInspectorId(event.inspector_id ?? "");
        setNotes(event.notes ?? "");
        setLinkedCmJobId(event.reference_type === "cm_job" ? event.reference_id ?? "" : "");
        setCmSearch("");
      } else {
        setTitle("");
        setEventType("other_visit");
        setStartDate(defaultDate ?? format(new Date(), "yyyy-MM-dd"));
        setEndDate(defaultDate ?? format(new Date(), "yyyy-MM-dd"));
        setInspectorId("");
        setNotes("");
        setLinkedCmJobId("");
        setCmSearch("");
      }
    }
  }, [open, event, defaultDate]);

  // Conflict detection
  const inspectorName = inspectors.find((i) => i.id === inspectorId)?.name;
  const conflicts = useMemo(
    () => findConflicts(inspectorId || null, startDate, endDate || startDate, allEvents, event?.id),
    [inspectorId, startDate, endDate, allEvents, event?.id],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const resolvedInspectorId = inspectorId && inspectorId !== "none" ? inspectorId : null;
      const payload: any = {
        title,
        event_type: eventType,
        start_date: startDate,
        end_date: endDate || startDate,
        inspector_id: resolvedInspectorId,
        notes: notes || null,
        created_by: user?.id ?? null,
      };

      // Link CM job reference
      if (eventType === "cm_job" && linkedCmJobId) {
        payload.reference_type = "cm_job";
        payload.reference_id = linkedCmJobId;
      } else {
        payload.reference_type = null;
        payload.reference_id = null;
      }

      if (isEdit) {
        const { error } = await supabase
          .from("scheduling_events")
          .update(payload)
          .eq("id", event!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("scheduling_events")
          .insert(payload);
        if (error) throw error;
      }

      // If cm_job linked, update cm_jobs.scheduled_date
      if (eventType === "cm_job" && linkedCmJobId) {
        await supabase
          .from("cm_jobs")
          .update({ scheduled_date: startDate })
          .eq("id", linkedCmJobId);
      }

      // Log to activity_log
      await supabase.from("activity_log").insert({
        action: isEdit ? "updated" : "created",
        entity_type: "scheduling_event",
        entity_id: event?.id ?? "00000000-0000-0000-0000-000000000000",
        user_id: user?.id ?? null,
        details: { title, event_type: eventType, start_date: startDate },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sched-events"] });
      qc.invalidateQueries({ queryKey: ["sched-cm-jobs"] });
      toast({ title: isEdit ? "Event updated" : "Event created" });
      onClose();
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("scheduling_events")
        .delete()
        .eq("id", event!.id);
      if (error) throw error;
      await supabase.from("activity_log").insert({
        action: "deleted",
        entity_type: "scheduling_event",
        entity_id: event!.id,
        user_id: user?.id ?? null,
        details: { title: event!.title },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sched-events"] });
      toast({ title: "Event deleted" });
      onClose();
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  // Virtual / read-only view
  if (event?.virtual || (!isManager && event)) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Event Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Title:</span> {event?.title}</p>
            <p>
              <span className="font-medium">Type:</span>{" "}
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 inline-block"
                  style={{ background: eventColor(event?.event_type ?? "", event?.color) }}
                />
                {EVENT_TYPES.find((e) => e.key === event?.event_type)?.label ?? event?.event_type}
              </span>
            </p>
            <p><span className="font-medium">Date:</span> {event?.start_date}{event?.end_date !== event?.start_date ? ` — ${event?.end_date}` : ""}</p>
            {event?.inspector_name && <p><span className="font-medium">Inspector:</span> {event.inspector_name}</p>}
            {event?.notes && <p><span className="font-medium">Notes:</span> {event.notes}</p>}
            {event?.virtual && (
              <p className="text-muted-foreground text-xs mt-2">This is an auto-generated event and cannot be edited here.</p>
            )}
            {!isManager && !event?.virtual && (
              <p className="text-muted-foreground text-xs mt-2">You don't have permission to edit events.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Event" : "Add Event"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Conflict Warning */}
          {conflicts.length > 0 && inspectorName && (
            <div className="flex items-start gap-2 p-2.5 rounded-md bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 text-sm">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-300">
                  {inspectorName} already has {conflicts.length === 1 ? "an event" : `${conflicts.length} events`} on this date:
                </p>
                {conflicts.map((c) => (
                  <p key={c.id} className="text-yellow-700 dark:text-yellow-400 text-xs">
                    "{c.title}" ({c.start_date}{c.end_date !== c.start_date ? ` — ${c.end_date}` : ""})
                  </p>
                ))}
                <p className="text-yellow-600 dark:text-yellow-500 text-xs mt-1">Continue anyway?</p>
              </div>
            </div>
          )}

          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" />
          </div>

          <div>
            <Label>Event Type</Label>
            <Select value={eventType} onValueChange={(v) => { setEventType(v); if (v !== "cm_job") { setLinkedCmJobId(""); setCmSearch(""); } }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                      {t.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* CM Job linking */}
          {eventType === "cm_job" && (
            <div className="relative">
              <Label>Link to CM Job (optional)</Label>
              <Input
                value={cmSearch}
                onChange={(e) => { setCmSearch(e.target.value); setCmDropdownOpen(true); }}
                placeholder={linkedCmJobId ? "Linked — type to change" : "Search jobs by title..."}
                onFocus={() => setCmDropdownOpen(true)}
              />
              {linkedCmJobId && (
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-muted-foreground">
                    Linked: {cmSearchResults.find((j) => j.id === linkedCmJobId)?.title || "Job selected"}
                  </span>
                  <button
                    className="text-xs text-destructive hover:underline"
                    onClick={() => { setLinkedCmJobId(""); setCmSearch(""); }}
                  >
                    Remove
                  </button>
                </div>
              )}
              {cmDropdownOpen && cmSearch.length >= 1 && cmSearchResults.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
                  {cmSearchResults.map((j) => (
                    <button
                      key={j.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                      onClick={() => {
                        setLinkedCmJobId(j.id);
                        setCmSearch(j.title);
                        setCmDropdownOpen(false);
                        if (!title) setTitle(j.title);
                      }}
                    >
                      <span className="font-medium">{j.title}</span>
                      {j.address && <span className="text-muted-foreground ml-1 text-xs">— {j.address}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <Label>Inspector</Label>
            <Select value={inspectorId || "none"} onValueChange={(v) => setInspectorId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {inspectors.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes" />
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          {isEdit && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete event?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{event?.title}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!title.trim() || !startDate || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving…" : isEdit ? "Update" : "Create"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Draggable Event Bar ────────────────────────────────────────────────────

function DraggableEvent({
  event,
  onClick,
  showInspector,
  isManager,
}: {
  event: CalendarEvent;
  onClick: () => void;
  showInspector?: boolean;
  isManager: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
    data: { event },
    disabled: event.virtual || !isManager,
  });

  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.5 : 1,
    borderLeftColor: eventColor(event.event_type, event.color),
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="text-[10px] leading-tight px-1.5 py-0.5 rounded border-l-2 bg-card truncate cursor-pointer hover:bg-accent/50 transition-colors mb-0.5"
      style={style}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={event.title}
    >
      <span className="font-medium">{event.title}</span>
      {showInspector && event.inspector_name && (
        <span className="text-muted-foreground ml-1">— {event.inspector_name}</span>
      )}
    </div>
  );
}

// ─── Droppable Day Cell ─────────────────────────────────────────────────────

function DroppableDay({
  dateStr,
  children,
  className,
  onClick,
}: {
  dateStr: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dateStr });
  return (
    <div
      ref={setNodeRef}
      className={`${className ?? ""} ${isOver ? "bg-accent/30" : ""}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// ─── Filter Popover ─────────────────────────────────────────────────────────

function FilterPopover({
  inspectors,
  selectedInspectors,
  setSelectedInspectors,
  selectedTypes,
  setSelectedTypes,
}: {
  inspectors: { id: string; name: string }[];
  selectedInspectors: string[];
  setSelectedInspectors: (v: string[]) => void;
  selectedTypes: string[];
  setSelectedTypes: (v: string[]) => void;
}) {
  const toggleInspector = (id: string) => {
    setSelectedInspectors(
      selectedInspectors.includes(id)
        ? selectedInspectors.filter((x) => x !== id)
        : [...selectedInspectors, id],
    );
  };
  const toggleType = (key: string) => {
    setSelectedTypes(
      selectedTypes.includes(key)
        ? selectedTypes.filter((x) => x !== key)
        : [...selectedTypes, key],
    );
  };
  const activeFilterCount =
    (selectedInspectors.length > 0 ? 1 : 0) + (selectedTypes.length > 0 ? 1 : 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 bg-primary text-primary-foreground rounded-full text-[10px] w-4 h-4 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-4" align="end">
        <div>
          <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Inspector</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {inspectors.map((i) => (
              <label key={i.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={selectedInspectors.includes(i.id)}
                  onCheckedChange={() => toggleInspector(i.id)}
                />
                {i.name}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Event Type</p>
          <div className="space-y-1.5">
            {EVENT_TYPES.map((t) => (
              <label key={t.key} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={selectedTypes.includes(t.key)}
                  onCheckedChange={() => toggleType(t.key)}
                />
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                {t.label}
              </label>
            ))}
          </div>
        </div>
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              setSelectedInspectors([]);
              setSelectedTypes([]);
            }}
          >
            Clear all filters
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── Month View ─────────────────────────────────────────────────────────────

function MonthView({
  currentDate,
  events,
  onDayClick,
  onEventClick,
  isManager,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onDayClick: (date: string) => void;
  onEventClick: (e: CalendarEvent) => void;
  isManager: boolean;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const weekdays = days.filter((d) => d.getDay() !== 0 && d.getDay() !== 6);
  const weeks: Date[][] = [];
  for (let i = 0; i < weekdays.length; i += 5) {
    weeks.push(weekdays.slice(i, i + 5));
  }

  const eventsForDay = (dateStr: string) =>
    events.filter((e) => {
      const s = e.start_date;
      const end = e.end_date ?? s;
      return dateStr >= s && dateStr <= end;
    });

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-5 bg-muted/50">
        {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
          <div key={d} className="text-center text-xs font-medium py-1.5 text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-5 border-t">
          {week.map((day) => {
            const ds = format(day, "yyyy-MM-dd");
            const dayEvents = eventsForDay(ds);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, new Date());

            return (
              <DroppableDay
                key={ds}
                dateStr={ds}
                className={`min-h-[80px] p-1 border-r last:border-r-0 cursor-pointer transition-colors hover:bg-accent/20 ${
                  !isCurrentMonth ? "bg-muted/20" : ""
                }`}
                onClick={() => onDayClick(ds)}
              >
                <div
                  className={`text-xs mb-0.5 ${
                    isToday
                      ? "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center font-bold"
                      : isCurrentMonth
                        ? "text-foreground"
                        : "text-muted-foreground"
                  }`}
                >
                  {format(day, "d")}
                </div>
                <div className="space-y-0">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <DraggableEvent
                      key={ev.id}
                      event={ev}
                      onClick={() => onEventClick(ev)}
                      isManager={isManager}
                    />
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-muted-foreground pl-1">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </DroppableDay>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Week View ──────────────────────────────────────────────────────────────

function WeekView({
  currentDate,
  events,
  onDayClick,
  onEventClick,
  isManager,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onDayClick: (date: string) => void;
  onEventClick: (e: CalendarEvent) => void;
  isManager: boolean;
}) {
  const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(ws, i));

  const eventsForDay = (dateStr: string) =>
    events.filter((e) => {
      const s = e.start_date;
      const end = e.end_date ?? s;
      return dateStr >= s && dateStr <= end;
    });

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-5 bg-muted/50">
        {weekDays.map((d) => {
          const isToday = isSameDay(d, new Date());
          return (
            <div
              key={format(d, "yyyy-MM-dd")}
              className={`text-center py-2 text-xs font-medium ${
                isToday ? "text-primary font-bold" : "text-muted-foreground"
              }`}
            >
              {format(d, "EEE d")}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-5 border-t">
        {weekDays.map((day) => {
          const ds = format(day, "yyyy-MM-dd");
          const dayEvents = eventsForDay(ds);

          return (
            <DroppableDay
              key={ds}
              dateStr={ds}
              className="min-h-[300px] p-1.5 border-r last:border-r-0 cursor-pointer hover:bg-accent/20 transition-colors"
              onClick={() => onDayClick(ds)}
            >
              <div className="space-y-1">
                {dayEvents.map((ev) => (
                  <DraggableEvent
                    key={ev.id}
                    event={ev}
                    onClick={() => onEventClick(ev)}
                    showInspector
                    isManager={isManager}
                  />
                ))}
              </div>
            </DroppableDay>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function OpsScheduling() {
  const { role, user, profile } = useAuth();
  const isManager = role === "admin" || role === "office_manager";
  const qc = useQueryClient();

  const [view, setView] = useState<"month" | "week">("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [scheduleUploadOpen, setScheduleUploadOpen] = useState(false);
  const [selectedInspectors, setSelectedInspectors] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedHistoryPlanId, setSelectedHistoryPlanId] = useState<string>("");
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

  const rangeStart = format(
    startOfWeek(startOfMonth(view === "month" ? currentDate : currentDate), { weekStartsOn: 1 }),
    "yyyy-MM-dd",
  );
  const rangeEnd = format(
    endOfWeek(endOfMonth(view === "month" ? currentDate : currentDate), { weekStartsOn: 1 }),
    "yyyy-MM-dd",
  );

  const { data: inspectors = [] } = useInspectors();
  const { data: dbEvents = [], isLoading: eventsLoading } = useSchedulingEvents(rangeStart, rangeEnd);
  const { derived, isLoading: derivedLoading } = useDerivedEvents(rangeStart, rangeEnd);

  // Auto-filter field_ops to their linked inspector
  useEffect(() => {
    if (role === "field_ops" && profile?.inspector_id && selectedInspectors.length === 0) {
      setSelectedInspectors([profile.inspector_id]);
    }
  }, [role, profile?.inspector_id]);

  // ---------- Schedule History ----------

  const { data: historyPlans = [] } = useQuery({
    queryKey: ["schedule-history-plans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("route_plans")
        .select("id, name, clients(name), regions(name)")
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const { data: scheduleHistory = [] } = useQuery({
    queryKey: ["schedule-history", selectedHistoryPlanId],
    enabled: !!selectedHistoryPlanId,
    queryFn: async () => {
      const { data: days } = await supabase
        .from("route_plan_days").select("id").eq("route_plan_id", selectedHistoryPlanId);
      if (!days?.length) return [];
      const { data: rpb } = await supabase
        .from("route_plan_buildings").select("building_id").in("route_plan_day_id", days.map(d => d.id));
      if (!rpb?.length) return [];
      const buildingIds = [...new Set(rpb.map(r => r.building_id))];
      const { data: buildings } = await supabase
        .from("buildings")
        .select("id, scheduled_week, inspection_status, is_priority")
        .in("id", buildingIds)
        .not("scheduled_week", "is", null);
      const groups: Record<string, { total: number; completed: number; priorities: number }> = {};
      for (const b of buildings ?? []) {
        const week = b.scheduled_week!;
        if (!groups[week]) groups[week] = { total: 0, completed: 0, priorities: 0 };
        groups[week].total++;
        if (b.inspection_status === "complete") groups[week].completed++;
        if (b.is_priority) groups[week].priorities++;
      }
      return Object.entries(groups)
        .map(([week, stats]) => ({ week, ...stats }))
        .sort((a, b) => a.week.localeCompare(b.week));
    },
  });

  const { data: expandedWeekBuildings = [] } = useQuery({
    queryKey: ["schedule-history-week", selectedHistoryPlanId, expandedWeek],
    enabled: !!selectedHistoryPlanId && !!expandedWeek,
    queryFn: async () => {
      const { data: days } = await supabase
        .from("route_plan_days").select("id").eq("route_plan_id", selectedHistoryPlanId);
      if (!days?.length) return [];
      const { data: rpb } = await supabase
        .from("route_plan_buildings").select("building_id").in("route_plan_day_id", days.map(d => d.id));
      if (!rpb?.length) return [];
      const buildingIds = [...new Set(rpb.map(r => r.building_id))];
      const { data: buildings } = await supabase
        .from("buildings")
        .select("id, property_name, address, city, inspection_status, is_priority")
        .in("id", buildingIds)
        .eq("scheduled_week", expandedWeek!);
      return (buildings ?? []) as any[];
    },
  });

  const allEvents = useMemo(() => {
    let merged = [...dbEvents, ...derived];
    if (selectedInspectors.length > 0) {
      merged = merged.filter((e) => e.inspector_id && selectedInspectors.includes(e.inspector_id));
    }
    if (selectedTypes.length > 0) {
      merged = merged.filter((e) => selectedTypes.includes(e.event_type));
    }
    return merged;
  }, [dbEvents, derived, selectedInspectors, selectedTypes]);

  // All events (unfiltered) for conflict detection
  const allEventsUnfiltered = useMemo(() => [...dbEvents, ...derived], [dbEvents, derived]);

  const goToday = () => setCurrentDate(new Date());
  const goPrev = () =>
    setCurrentDate((d) => (view === "month" ? subMonths(d, 1) : subWeeks(d, 1)));
  const goNext = () =>
    setCurrentDate((d) => (view === "month" ? addMonths(d, 1) : addWeeks(d, 1)));

  const onDayClick = useCallback(
    (date: string) => {
      if (!isManager) return;
      setSelectedEvent(null);
      setDefaultDate(date);
      setDialogOpen(true);
    },
    [isManager],
  );

  const onEventClick = useCallback((ev: CalendarEvent) => {
    setSelectedEvent(ev);
    setDefaultDate(undefined);
    setDialogOpen(true);
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const reschedule = useMutation({
    mutationFn: async ({ eventId, newDate }: { eventId: string; newDate: string }) => {
      const original = dbEvents.find((e) => e.id === eventId);
      if (!original) throw new Error("Event not found");
      const dayDiff = differenceInCalendarDays(parseISO(newDate), parseISO(original.start_date));
      const newEnd = format(addDays(parseISO(original.end_date), dayDiff), "yyyy-MM-dd");
      const { error } = await supabase
        .from("scheduling_events")
        .update({ start_date: newDate, end_date: newEnd })
        .eq("id", eventId);
      if (error) throw error;

      // Log reschedule
      await supabase.from("activity_log").insert({
        action: "rescheduled",
        entity_type: "scheduling_event",
        entity_id: eventId,
        user_id: user?.id ?? null,
        details: { title: original.title, from: original.start_date, to: newDate },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sched-events"] });
      toast({ title: "Event rescheduled" });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      if (!isManager) return;
      const { active, over } = e;
      if (!over) return;
      const eventId = active.id as string;
      const newDate = over.id as string;
      const ev = dbEvents.find((x) => x.id === eventId);
      if (!ev || ev.virtual) return;
      if (ev.start_date === newDate) return;

      // Check for conflicts and warn via toast
      if (ev.inspector_id) {
        const conflicts = findConflicts(ev.inspector_id, newDate, newDate, allEventsUnfiltered, ev.id);
        if (conflicts.length > 0) {
          const inspName = inspectors.find((i) => i.id === ev.inspector_id)?.name ?? "Inspector";
          toast({
            title: `⚠️ Schedule conflict`,
            description: `${inspName} already has "${conflicts[0].title}" on ${newDate}. Event moved anyway.`,
          });
        }
      }

      reschedule.mutate({ eventId, newDate });
    },
    [isManager, dbEvents, reschedule, allEventsUnfiltered, inspectors],
  );

  const loading = eventsLoading || derivedLoading;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">Scheduling</h1>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <div className="flex border rounded-md overflow-hidden">
            <button
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "month" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              }`}
              onClick={() => setView("month")}
            >
              Month
            </button>
            <button
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "week" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              }`}
              onClick={() => setView("week")}
            >
              Week
            </button>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={goToday}>
              Today
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <span className="text-sm font-semibold min-w-[140px] text-center">
            {view === "month"
              ? format(currentDate, "MMMM yyyy")
              : `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "MMM d, yyyy")}`}
          </span>

          <FilterPopover
            inspectors={inspectors}
            selectedInspectors={selectedInspectors}
            setSelectedInspectors={setSelectedInspectors}
            selectedTypes={selectedTypes}
            setSelectedTypes={setSelectedTypes}
          />

          {isManager && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setScheduleUploadOpen(true)}
              >
                <Upload className="h-4 w-4" /> Upload Schedule
              </Button>
              <Button
                size="sm"
                className="gap-1"
                onClick={() => {
                  setSelectedEvent(null);
                  setDefaultDate(format(new Date(), "yyyy-MM-dd"));
                  setDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Add Event
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {EVENT_TYPES.map((t) => (
          <div key={t.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
            {t.label}
          </div>
        ))}
      </div>

      {/* Calendar */}
      {loading ? (
        <Skeleton className="h-[500px] rounded-lg" />
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          {view === "month" ? (
            <MonthView
              currentDate={currentDate}
              events={allEvents}
              onDayClick={onDayClick}
              onEventClick={onEventClick}
              isManager={isManager}
            />
          ) : (
            <WeekView
              currentDate={currentDate}
              events={allEvents}
              onDayClick={onDayClick}
              onEventClick={onEventClick}
              isManager={isManager}
            />
          )}
        </DndContext>
      )}

      {/* Schedule History */}
      {isManager && (
        <Card className="mt-6">
          <CardContent className="pt-4 space-y-4">
            <p className="text-sm font-semibold">Schedule History</p>
            <Select value={selectedHistoryPlanId} onValueChange={(v) => { setSelectedHistoryPlanId(v); setExpandedWeek(null); }}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select route plan…" />
              </SelectTrigger>
              <SelectContent>
                {historyPlans.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {p.clients?.name} / {p.regions?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedHistoryPlanId && scheduleHistory.length === 0 && (
              <p className="text-xs text-muted-foreground">No scheduled weeks found for this plan.</p>
            )}

            {scheduleHistory.map((wk: any) => {
              const pct = wk.total > 0 ? Math.round((wk.completed / wk.total) * 100) : 0;
              const isExpanded = expandedWeek === wk.week;
              return (
                <div key={wk.week} className="border rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
                    onClick={() => setExpandedWeek(isExpanded ? null : wk.week)}
                  >
                    <div className="space-y-1 flex-1">
                      <p className="text-sm font-medium">
                        Week of {format(parseISO(wk.week), "MMM d, yyyy")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {wk.total} buildings · {wk.completed} complete · {wk.priorities} priority
                      </p>
                      <div className="w-full bg-secondary rounded-full h-1.5 mt-1">
                        <div
                          className="bg-primary h-1.5 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 ml-2 shrink-0" /> : <ChevronDown className="h-4 w-4 ml-2 shrink-0" />}
                  </button>
                  {isExpanded && (
                    <div className="border-t px-3 py-2 space-y-1 bg-muted/20">
                      {expandedWeekBuildings.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">Loading…</p>
                      ) : (
                        expandedWeekBuildings.map((b: any) => (
                          <div key={b.id} className="flex items-center justify-between text-xs py-1">
                            <span className="truncate flex-1">{b.property_name} — {b.address}, {b.city}</span>
                            <span className={`ml-2 shrink-0 ${b.inspection_status === "complete" ? "text-green-600" : "text-muted-foreground"}`}>
                              {b.inspection_status}
                            </span>
                            {b.is_priority && (
                              <span className="ml-1 text-orange-500 text-[10px] font-medium">★</span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Event Dialog */}
      <EventDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedEvent(null);
        }}
        event={selectedEvent}
        defaultDate={defaultDate}
        inspectors={inspectors}
        allEvents={allEventsUnfiltered}
        isManager={isManager}
      />
      <ScheduleUpload
        open={scheduleUploadOpen}
        onClose={() => setScheduleUploadOpen(false)}
      />
    </div>
  );
}
