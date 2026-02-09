import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  SkipForward,
  AlertTriangle,
  Navigation,
  ChevronDown,
  ChevronUp,
  Building2,
  MapPin,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface FieldBuilding {
  id: string;
  property_name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  inspection_status: string;
  inspector_notes: string | null;
  is_priority: boolean | null;
  roof_access_type: string | null;
  access_location: string | null;
  lock_gate_codes: string | null;
  stop_order: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "text-muted-foreground", bg: "bg-muted" },
  in_progress: { label: "In Progress", color: "text-info", bg: "bg-info/20" },
  complete: { label: "Complete", color: "text-success", bg: "bg-success/20" },
  skipped: { label: "Skipped", color: "text-warning", bg: "bg-warning/20" },
  needs_revisit: { label: "Needs Revisit", color: "text-destructive", bg: "bg-destructive/20" },
};

export default function FieldView() {
  const [searchParams] = useSearchParams();
  const planFromUrl = searchParams.get("plan");
  const [buildings, setBuildings] = useState<FieldBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteDialog, setNoteDialog] = useState<{ id: string; status: string } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);

  // Route plan selection
  const [routePlans, setRoutePlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState("");

  useEffect(() => {
    loadRoutePlans();
  }, []);

  useEffect(() => {
    if (selectedPlan) loadBuildings();
  }, [selectedPlan]);

  const loadRoutePlans = async () => {
    const { data } = await supabase
      .from("route_plans")
      .select("id, name, inspectors(name), clients(name), regions(name)")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) {
      setRoutePlans(data);
      // Use plan from URL if available, otherwise first plan
      if (planFromUrl && data.some((p: any) => p.id === planFromUrl)) {
        setSelectedPlan(planFromUrl);
      } else if (data.length > 0) {
        setSelectedPlan(data[0].id);
      }
    }
    if (!data || data.length === 0) setLoading(false);
  };

  const loadBuildings = async () => {
    setLoading(true);
    const { data: days } = await supabase
      .from("route_plan_days")
      .select("id")
      .eq("route_plan_id", selectedPlan)
      .order("day_number");

    if (!days || days.length === 0) {
      setBuildings([]);
      setLoading(false);
      return;
    }

    const dayIds = days.map((d) => d.id);
    const { data: rpBuildings } = await supabase
      .from("route_plan_buildings")
      .select("stop_order, buildings(*)")
      .in("route_plan_day_id", dayIds)
      .order("stop_order");

    if (rpBuildings) {
      const mapped: FieldBuilding[] = rpBuildings.map((rpb: any) => ({
        id: rpb.buildings.id,
        property_name: rpb.buildings.property_name,
        address: rpb.buildings.address,
        city: rpb.buildings.city,
        state: rpb.buildings.state,
        zip_code: rpb.buildings.zip_code,
        inspection_status: rpb.buildings.inspection_status || "pending",
        inspector_notes: rpb.buildings.inspector_notes,
        is_priority: rpb.buildings.is_priority,
        roof_access_type: rpb.buildings.roof_access_type,
        access_location: rpb.buildings.access_location,
        lock_gate_codes: rpb.buildings.lock_gate_codes,
        stop_order: rpb.stop_order,
      }));
      setBuildings(mapped);
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string, notes?: string) => {
    setSaving(true);
    const update: any = {
      inspection_status: status,
      completion_date: status === "complete" ? new Date().toISOString() : null,
    };
    if (notes !== undefined) update.inspector_notes = notes;

    const { error } = await supabase.from("buildings").update(update).eq("id", id);
    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success(`Marked as ${STATUS_CONFIG[status]?.label || status}`);
      setBuildings((prev) =>
        prev.map((b) =>
          b.id === id
            ? { ...b, inspection_status: status, inspector_notes: notes ?? b.inspector_notes }
            : b
        )
      );
    }
    setSaving(false);
    setNoteDialog(null);
    setNoteText("");
  };

  const handleStatusTap = (id: string, status: string) => {
    if (status === "skipped" || status === "needs_revisit") {
      setNoteDialog({ id, status });
      setNoteText("");
    } else {
      updateStatus(id, status);
    }
  };

  const openNavigation = (b: FieldBuilding) => {
    const addr = encodeURIComponent(`${b.address}, ${b.city}, ${b.state} ${b.zip_code}`);
    // Use universal maps link that works on both iOS and Android
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS
      ? `maps://maps.apple.com/?daddr=${addr}`
      : `https://www.google.com/maps/dir/?api=1&destination=${addr}`;
    window.open(url, "_blank");
  };

  const completedCount = buildings.filter((b) => b.inspection_status === "complete").length;
  const totalCount = buildings.length;

  // Find the next pending building
  const nextPending = buildings.find(
    (b) => b.inspection_status === "pending" || b.inspection_status === "in_progress"
  );

  return (
    <div className="max-w-lg mx-auto pb-24">
      <div className="sticky top-0 z-10 bg-background border-b border-border pb-3 pt-2 px-1">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Field View
          </h1>
          <Badge variant="outline" className="text-sm">
            {completedCount}/{totalCount}
          </Badge>
        </div>

        {routePlans.length > 0 && (
          <Select value={selectedPlan} onValueChange={setSelectedPlan}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select route" />
            </SelectTrigger>
            <SelectContent>
              {routePlans.map((rp: any) => (
                <SelectItem key={rp.id} value={rp.id}>
                  {rp.name} — {(rp.inspectors as any)?.name || "?"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Progress bar */}
        <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-success transition-all duration-300"
            style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : "0%" }}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : buildings.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No buildings found for this route.</p>
        </div>
      ) : (
        <div className="space-y-2 mt-3">
          {/* Next up card */}
          {nextPending && (
            <div className="p-4 rounded-xl border-2 border-primary bg-primary/5 mb-4">
              <div className="text-xs text-primary font-semibold uppercase tracking-wider mb-1">
                Next Up — Stop #{nextPending.stop_order}
              </div>
              <div className="font-bold text-lg">{nextPending.property_name}</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                {nextPending.address}, {nextPending.city}
              </div>
              <Button
                className="mt-3 w-full"
                onClick={() => openNavigation(nextPending)}
              >
                <Navigation className="h-4 w-4 mr-2" />
                Navigate
              </Button>
            </div>
          )}

          {buildings.map((b) => {
            const cfg = STATUS_CONFIG[b.inspection_status] || STATUS_CONFIG.pending;
            const isExpanded = expandedId === b.id;

            return (
              <div
                key={b.id}
                className={`rounded-xl border transition-all ${
                  b.inspection_status === "complete"
                    ? "border-success/30 bg-success/5"
                    : b.inspection_status === "needs_revisit"
                    ? "border-destructive/30 bg-destructive/5"
                    : b.inspection_status === "skipped"
                    ? "border-warning/30 bg-warning/5"
                    : "border-border bg-card"
                }`}
              >
                <button
                  className="w-full text-left p-4"
                  onClick={() => setExpandedId(isExpanded ? null : b.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono">
                          #{b.stop_order}
                        </span>
                        {b.is_priority && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            Priority
                          </Badge>
                        )}
                      </div>
                      <div className="font-semibold mt-0.5 truncate">{b.property_name}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {b.address}, {b.city}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <Badge className={`${cfg.bg} ${cfg.color} border-0 text-xs`}>
                        {cfg.label}
                      </Badge>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                    {/* Details */}
                    {b.lock_gate_codes && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Codes:</span>{" "}
                        <span className="font-mono">{b.lock_gate_codes}</span>
                      </div>
                    )}
                    {b.access_location && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Access:</span> {b.access_location}
                      </div>
                    )}
                    {b.inspector_notes && (
                      <div className="text-sm p-2 rounded bg-muted">
                        <span className="text-muted-foreground">Notes:</span> {b.inspector_notes}
                      </div>
                    )}

                    {/* Navigate button */}
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => openNavigation(b)}
                    >
                      <Navigation className="h-4 w-4 mr-2" />
                      Navigate
                    </Button>

                    {/* Status action buttons — large tap targets */}
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        size="lg"
                        className="h-14 flex-col gap-1 bg-success/20 text-success hover:bg-success/30 border border-success/30"
                        variant="ghost"
                        disabled={saving}
                        onClick={() => handleStatusTap(b.id, "complete")}
                      >
                        <Check className="h-5 w-5" />
                        <span className="text-xs">Complete</span>
                      </Button>
                      <Button
                        size="lg"
                        className="h-14 flex-col gap-1 bg-warning/20 text-warning hover:bg-warning/30 border border-warning/30"
                        variant="ghost"
                        disabled={saving}
                        onClick={() => handleStatusTap(b.id, "skipped")}
                      >
                        <SkipForward className="h-5 w-5" />
                        <span className="text-xs">Skip</span>
                      </Button>
                      <Button
                        size="lg"
                        className="h-14 flex-col gap-1 bg-destructive/20 text-destructive hover:bg-destructive/30 border border-destructive/30"
                        variant="ghost"
                        disabled={saving}
                        onClick={() => handleStatusTap(b.id, "needs_revisit")}
                      >
                        <AlertTriangle className="h-5 w-5" />
                        <span className="text-xs">Revisit</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Note required dialog */}
      <Dialog open={!!noteDialog} onOpenChange={(o) => !o && setNoteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {noteDialog?.status === "skipped" ? "Why was this skipped?" : "What needs revisiting?"}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Enter notes..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialog(null)}>
              Cancel
            </Button>
            <Button
              disabled={!noteText.trim() || saving}
              onClick={() => {
                if (noteDialog) updateStatus(noteDialog.id, noteDialog.status, noteText.trim());
              }}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
