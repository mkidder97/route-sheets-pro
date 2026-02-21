import { useState, useMemo, useCallback } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  addMonths, subMonths, addWeeks, subWeeks,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay,
  isWithinInterval, parseISO, differenceInCalendarDays,
  addDays,
} from "date-fns";
import {
  ChevronLeft, ChevronRight, Plus, Filter, Trash2,
} from "lucide-react";
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

type EventType = (typeof EVENT_TYPES)[number]["key"];

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
  virtual?: boolean; // derived events can't be edited
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
  // Route plan days → annuals events
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

  // Count buildings per route_plan_day
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

  // CM jobs with scheduled_date
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

    // Route plan derived
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

    // CM job derived
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

// ─── Event Dialog ───────────────────────────────────────────────────────────

interface EventDialogProps {
  open: boolean;
  onClose: () => void;
  event: CalendarEvent | null;
  defaultDate?: string;
  inspectors: { id: string; name: string }[];
}

function EventDialog({ open, onClose, event, defaultDate, inspectors }: EventDialogProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isEdit = !!event && !event.virtual;

  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<string>("other_visit");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [inspectorId, setInspectorId] = useState<string>("");
  const [notes, setNotes] = useState("");

  // Reset form when dialog opens
  useMemo(() => {
    if (open) {
      if (event && !event.virtual) {
        setTitle(event.title);
        setEventType(event.event_type);
        setStartDate(event.start_date);
        setEndDate(event.end_date ?? event.start_date);
        setInspectorId(event.inspector_id ?? "");
        setNotes(event.notes ?? "");
      } else {
        setTitle("");
        setEventType("other_visit");
        setStartDate(defaultDate ?? format(new Date(), "yyyy-MM-dd"));
        setEndDate(defaultDate ?? format(new Date(), "yyyy-MM-dd"));
        setInspectorId("");
        setNotes("");
      }
    }
  }, [open, event, defaultDate]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        event_type: eventType,
        start_date: startDate,
        end_date: endDate || startDate,
        inspector_id: inspectorId || null,
        notes: notes || null,
        created_by: user?.id ?? null,
      };
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
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sched-events"] });
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{event?.virtual ? "Event Details" : isEdit ? "Edit Event" : "Add Event"}</DialogTitle>
        </DialogHeader>
        {event?.virtual ? (
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Title:</span> {event.title}</p>
            <p><span className="font-medium">Type:</span> {EVENT_TYPES.find((e) => e.key === event.event_type)?.label ?? event.event_type}</p>
            <p><span className="font-medium">Date:</span> {event.start_date}{event.end_date !== event.start_date ? ` — ${event.end_date}` : ""}</p>
            {event.inspector_name && <p><span className="font-medium">Inspector:</span> {event.inspector_name}</p>}
            {event.notes && <p><span className="font-medium">Notes:</span> {event.notes}</p>}
            <p className="text-muted-foreground text-xs mt-2">This is an auto-generated event and cannot be edited here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Event Type</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
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
              <Label>Inspector</Label>
              <Select value={inspectorId} onValueChange={setInspectorId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {inspectors.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
        )}
        {!event?.virtual && (
          <DialogFooter className="flex justify-between">
            {isEdit && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!title.trim() || !startDate || saveMutation.isPending}
              >
                {isEdit ? "Update" : "Create"}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Draggable Event Bar ────────────────────────────────────────────────────

function DraggableEvent({
  event,
  onClick,
  showInspector,
}: {
  event: CalendarEvent;
  onClick: () => void;
  showInspector?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
    data: { event },
    disabled: event.virtual,
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
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onDayClick: (date: string) => void;
  onEventClick: (e: CalendarEvent) => void;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  // Filter to Mon-Fri
  const weekdays = days.filter((d) => d.getDay() !== 0 && d.getDay() !== 6);

  // Build weeks
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
      {/* Header */}
      <div className="grid grid-cols-5 bg-muted/50">
        {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
          <div key={d} className="text-center text-xs font-medium py-1.5 text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      {/* Rows */}
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
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onDayClick: (date: string) => void;
  onEventClick: (e: CalendarEvent) => void;
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
  const { role, user } = useAuth();
  const isManager = role === "admin" || role === "office_manager";
  const qc = useQueryClient();

  const [view, setView] = useState<"month" | "week">("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [selectedInspectors, setSelectedInspectors] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  // Compute range for queries
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

  // Merge and filter events
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

  // Navigation
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

  // Drag-to-reschedule
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const reschedule = useMutation({
    mutationFn: async ({ eventId, newDate }: { eventId: string; newDate: string }) => {
      // Get original event to compute day offset
      const original = dbEvents.find((e) => e.id === eventId);
      if (!original) throw new Error("Event not found");
      const dayDiff = differenceInCalendarDays(parseISO(newDate), parseISO(original.start_date));
      const newEnd = format(addDays(parseISO(original.end_date), dayDiff), "yyyy-MM-dd");
      const { error } = await supabase
        .from("scheduling_events")
        .update({ start_date: newDate, end_date: newEnd })
        .eq("id", eventId);
      if (error) throw error;
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
      reschedule.mutate({ eventId, newDate });
    },
    [isManager, dbEvents, reschedule],
  );

  const loading = eventsLoading || derivedLoading;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">Scheduling</h1>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* View toggle */}
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

          {/* Navigation */}
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
            />
          ) : (
            <WeekView
              currentDate={currentDate}
              events={allEvents}
              onDayClick={onDayClick}
              onEventClick={onEventClick}
            />
          )}
        </DndContext>
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
      />
    </div>
  );
}
