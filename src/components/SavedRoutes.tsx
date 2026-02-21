import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MapPin, ChevronDown, ChevronUp, Trash2, Check, Navigation, SkipForward, AlertTriangle, FileText, FileSpreadsheet, Crosshair, ArrowRightLeft, Camera, Image as ImageIcon, Undo2 } from "lucide-react";
import { haversineDistance } from "@/lib/geo-utils";
import { generateInspectorPDF, type DayData, type BuildingData, type DocumentMetadata } from "@/lib/pdf-generator";
import { generateInspectorExcel } from "@/lib/excel-generator";
import { ocrImage, matchBuilding, compareSF, type CadMatch } from "@/lib/cad-ocr";
import * as XLSX from "xlsx";

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  pending: { label: "Pending", badge: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", badge: "bg-info/20 text-info" },
  complete: { label: "Complete", badge: "bg-success/20 text-success" },
  skipped: { label: "Skipped", badge: "bg-warning/20 text-warning" },
  needs_revisit: { label: "Needs Revisit", badge: "bg-destructive/20 text-destructive" },
};

interface SavedRoutePlan {
  id: string;
  name: string;
  created_at: string;
  buildings_per_day: number;
  clients: { name: string } | null;
  regions: { name: string } | null;
  inspectors: { name: string } | null;
}

interface SavedDayBuilding {
  id: string;
  property_name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  inspection_status: string;
  inspector_notes: string | null;
  is_priority: boolean | null;
  stop_order: number;
  square_footage: number | null;
  roof_access_type: string | null;
  access_location: string | null;
  lock_gate_codes: string | null;
  special_equipment: string[] | null;
  special_notes: string | null;
  property_manager_name: string | null;
  property_manager_phone: string | null;
  property_manager_email: string | null;
  requires_advance_notice: boolean | null;
  requires_escort: boolean | null;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
}

interface SavedDay {
  id: string;
  day_number: number;
  day_date: string;
  estimated_distance_miles: number | null;
  buildings: SavedDayBuilding[];
}

export default function SavedRoutes({ inspectorId }: { inspectorId?: string }) {
  const [plans, setPlans] = useState<SavedRoutePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [expandedBuilding, setExpandedBuilding] = useState<string | null>(null);
  const [days, setDays] = useState<SavedDay[]>([]);
  const [hideComplete, setHideComplete] = useState(
    () => localStorage.getItem("roofroute_auto_hide_complete") === "true"
  );
  const [needsCadFilter, setNeedsCadFilter] = useState(false);
  const [cadPreview, setCadPreview] = useState<string | null>(null);
  
  // Batch CAD upload state
  const [cadProcessing, setCadProcessing] = useState(false);
  const [cadMatches, setCadMatches] = useState<CadMatch[]>([]);
  const [cadChecked, setCadChecked] = useState<Record<number, boolean>>({});
  const [cadConfirmOpen, setCadConfirmOpen] = useState(false);
  const [cadSaving, setCadSaving] = useState(false);
  const batchCadInputRef = useRef<HTMLInputElement>(null);

  // Confirm status dialog
  const [confirmAction, setConfirmAction] = useState<{ id: string; status: string } | null>(null);
  const [loadingDays, setLoadingDays] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SavedRoutePlan | null>(null);

  // Status note dialog
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const dayPickerRef = useRef<HTMLDivElement>(null);

  // Location sort state
  const [locationSort, setLocationSort] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [priorityFirst, setPriorityFirst] = useState(true);

  // Status note dialog
  const [noteDialog, setNoteDialog] = useState<{ id: string; status: string } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Bulk selection state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Move building state
  const [moveTarget, setMoveTarget] = useState<{
    buildingId: string;
    fromDayId: string;
    fromDayNumber: number;
  } | null>(null);
  const [moving, setMoving] = useState(false);

  const handleMoveBuilding = async (toDayId: string, toDayNumber: number) => {
    if (!moveTarget) return;
    setMoving(true);
    try {
      const targetDay = days.find((d) => d.id === toDayId);
      const maxOrder = targetDay
        ? Math.max(0, ...targetDay.buildings.map((b) => b.stop_order))
        : 0;

      const { error } = await supabase
        .from("route_plan_buildings")
        .update({
          route_plan_day_id: toDayId,
          stop_order: maxOrder + 1,
        })
        .eq("building_id", moveTarget.buildingId)
        .eq("route_plan_day_id", moveTarget.fromDayId);

      if (error) throw error;

      // Re-number source day stop_orders
      const sourceDayBuildings = days
        .find((d) => d.id === moveTarget.fromDayId)
        ?.buildings.filter((b) => b.id !== moveTarget.buildingId) || [];

      for (let i = 0; i < sourceDayBuildings.length; i++) {
        await supabase
          .from("route_plan_buildings")
          .update({ stop_order: i + 1 })
          .eq("building_id", sourceDayBuildings[i].id)
          .eq("route_plan_day_id", moveTarget.fromDayId);
      }

      // Update local state
      setDays((prev) => {
        const building = prev
          .find((d) => d.id === moveTarget.fromDayId)
          ?.buildings.find((b) => b.id === moveTarget.buildingId);
        if (!building) return prev;

        return prev.map((d) => {
          if (d.id === moveTarget.fromDayId) {
            const remaining = d.buildings
              .filter((b) => b.id !== moveTarget.buildingId)
              .map((b, i) => ({ ...b, stop_order: i + 1 }));
            return { ...d, buildings: remaining };
          }
          if (d.id === toDayId) {
            return {
              ...d,
              buildings: [...d.buildings, { ...building, stop_order: maxOrder + 1 }],
            };
          }
          return d;
        });
      });

      toast.success(`Moved to Day ${toDayNumber}`);
      setMoveTarget(null);
    } catch (err: any) {
      toast.error(`Move failed: ${err.message}`);
    }
    setMoving(false);
  };

  const openNavigation = (address: string, city: string, state: string, zipCode: string) => {
    const addr = encodeURIComponent(`${address}, ${city}, ${state} ${zipCode}`);
    const navPref = localStorage.getItem("roofroute_nav_app") || "auto";
    let url: string;
    if (navPref === "google") {
      url = `https://www.google.com/maps/dir/?api=1&destination=${addr}`;
    } else if (navPref === "apple") {
      url = `maps://maps.apple.com/?daddr=${addr}`;
    } else if (navPref === "waze") {
      url = `https://waze.com/ul?q=${addr}&navigate=yes`;
    } else {
      // Auto: detect device
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      url = isIOS
        ? `maps://maps.apple.com/?daddr=${addr}`
        : `https://www.google.com/maps/dir/?api=1&destination=${addr}`;
    }
    window.open(url, "_blank");
  };

  const handleBatchCadUpload = useCallback(async (files: FileList) => {
    const allBuildings = days.flatMap((d) => d.buildings);
    if (allBuildings.length === 0) return;

    setCadProcessing(true);
    const matches: CadMatch[] = [];

    for (const file of Array.from(files)) {
      try {
        const { extractedSF, rawText, titleBlockFields } = await ocrImage(file);
        const { building, confidence } = matchBuilding(
          rawText,
          allBuildings.map((b) => ({ id: b.id, property_name: b.property_name, address: b.address })),
          titleBlockFields
        );
        matches.push({
          file,
          matchedBuilding: building,
          confidence,
          extractedSF,
          rawText,
        });
      } catch {
        matches.push({
          file,
          matchedBuilding: null,
          confidence: "none",
          extractedSF: null,
          rawText: "",
        });
      }
    }

    setCadMatches(matches);
    // Pre-check high-confidence matches
    const checked: Record<number, boolean> = {};
    matches.forEach((m, i) => {
      checked[i] = m.confidence === "high";
    });
    setCadChecked(checked);
    setCadProcessing(false);
    setCadConfirmOpen(true);
  }, [days]);

  const confirmBatchCadUpload = useCallback(async () => {
    setCadSaving(true);
    let successCount = 0;
    const sfWarnings: string[] = [];

    for (let i = 0; i < cadMatches.length; i++) {
      if (!cadChecked[i] || !cadMatches[i].matchedBuilding) continue;
      const match = cadMatches[i];
      const buildingId = match.matchedBuilding!.id;

      try {
        const ext = match.file.name.split(".").pop() || "jpg";
        const path = `${buildingId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("cad-drawings")
          .upload(path, match.file, { upsert: true });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("cad-drawings")
          .getPublicUrl(path);

        await supabase
          .from("buildings")
          .update({
            photo_url: urlData.publicUrl,
            inspection_status: "complete",
            completion_date: new Date().toISOString(),
          })
          .eq("id", buildingId);

        // Update local state
        setDays((prev) =>
          prev.map((d) => ({
            ...d,
            buildings: d.buildings.map((b) =>
              b.id === buildingId
                ? { ...b, photo_url: urlData.publicUrl, inspection_status: "complete" }
                : b
            ),
          }))
        );

        // SF validation
        if (match.extractedSF) {
          const building = days.flatMap((d) => d.buildings).find((b) => b.id === buildingId);
          if (building?.square_footage) {
            const result = compareSF(match.extractedSF, building.square_footage);
            if (result === "mismatch") {
              sfWarnings.push(
                `${match.matchedBuilding!.property_name}: CAD shows ${match.extractedSF.toLocaleString()} SF vs ${building.square_footage.toLocaleString()} SF`
              );
            }
          }
        }

        successCount++;
      } catch {
        // Skip failed uploads silently
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} CAD${successCount > 1 ? "s" : ""} uploaded & marked complete`);
    }
    if (sfWarnings.length > 0) {
      toast.warning(sfWarnings.join("\n"), { duration: 10000 });
    }

    setCadSaving(false);
    setCadConfirmOpen(false);
    setCadMatches([]);
    setCadChecked({});
  }, [cadMatches, cadChecked, days]);

  const onBatchCadFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleBatchCadUpload(e.target.files);
    }
    e.target.value = "";
  };


  useEffect(() => {
    setExpandedPlan(null);
    setExpandedBuilding(null);
    setSelectedDayIndex(0);
    setDays([]);
    loadPlans();
  }, [inspectorId]);

  // Clear bulk selection when day changes or bulk mode toggles off
  useEffect(() => {
    setSelectedIds(new Set());
    setBulkMode(false);
  }, [selectedDayIndex]);

  useEffect(() => {
    if (dayPickerRef.current && days.length > 0) {
      const selectedChip = dayPickerRef.current.children[selectedDayIndex] as HTMLElement;
      if (selectedChip) {
        selectedChip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [selectedDayIndex, days.length]);

  const loadPlans = async () => {
    let query = supabase
      .from("route_plans")
      .select("id, name, created_at, buildings_per_day, clients(name), regions(name), inspectors(name)");
    if (inspectorId) {
      query = query.eq("inspector_id", inspectorId);
    }
    const { data } = await query
      .order("created_at", { ascending: false })
      .limit(50);
    setPlans((data as SavedRoutePlan[]) || []);
    setLoading(false);
  };

  const toggleExpand = async (planId: string) => {
    if (expandedPlan === planId) {
      setExpandedPlan(null);
      setSelectedDayIndex(0);
      setLocationSort(false);
      setUserLocation(null);
      setLocationLoading(false);
      return;
    }
    setLocationSort(false);
    setUserLocation(null);
    setLocationLoading(false);
    setExpandedPlan(planId);
    setLoadingDays(true);

    const { data: dayRows } = await supabase
      .from("route_plan_days")
      .select("id, day_number, day_date, estimated_distance_miles")
      .eq("route_plan_id", planId)
      .order("day_number");

    if (!dayRows || dayRows.length === 0) {
      setDays([]);
      setLoadingDays(false);
      return;
    }

    const dayIds = dayRows.map((d) => d.id);
    const { data: rpb } = await supabase
      .from("route_plan_buildings")
      .select("route_plan_day_id, stop_order, buildings(id, property_name, address, city, state, zip_code, inspection_status, inspector_notes, is_priority, square_footage, roof_access_type, access_location, lock_gate_codes, special_equipment, special_notes, property_manager_name, property_manager_phone, property_manager_email, requires_advance_notice, requires_escort, latitude, longitude, photo_url)")
      .in("route_plan_day_id", dayIds)
      .order("stop_order");

    const result: SavedDay[] = dayRows.map((d) => ({
      id: d.id,
      day_number: d.day_number,
      day_date: d.day_date,
      estimated_distance_miles: d.estimated_distance_miles ? Number(d.estimated_distance_miles) : null,
      buildings: ((rpb || []) as any[])
        .filter((r) => r.route_plan_day_id === d.id)
        .map((r) => ({
          id: r.buildings.id,
          property_name: r.buildings.property_name,
          address: r.buildings.address,
          city: r.buildings.city,
          state: r.buildings.state,
          zip_code: r.buildings.zip_code,
          inspection_status: r.buildings.inspection_status || "pending",
          inspector_notes: r.buildings.inspector_notes,
          is_priority: r.buildings.is_priority,
          stop_order: r.stop_order,
          square_footage: r.buildings.square_footage,
          roof_access_type: r.buildings.roof_access_type,
          access_location: r.buildings.access_location,
          lock_gate_codes: r.buildings.lock_gate_codes,
          special_equipment: r.buildings.special_equipment,
          special_notes: r.buildings.special_notes,
          property_manager_name: r.buildings.property_manager_name,
          property_manager_phone: r.buildings.property_manager_phone,
          property_manager_email: r.buildings.property_manager_email,
          requires_advance_notice: r.buildings.requires_advance_notice,
          requires_escort: r.buildings.requires_escort,
          latitude: r.buildings.latitude,
          longitude: r.buildings.longitude,
          photo_url: r.buildings.photo_url,
        })),
    }));

    setDays(result);
    const firstIncompleteIdx = result.findIndex(d => d.buildings.some(b => b.inspection_status !== "complete"));
    setSelectedDayIndex(firstIncompleteIdx >= 0 ? firstIncompleteIdx : 0);
    setLoadingDays(false);
  };

  const handleStatusChange = (buildingId: string, newStatus: string) => {
    const confirmPref = localStorage.getItem("roofroute_confirm_status") === "true";
    if (newStatus === "skipped" || newStatus === "needs_revisit") {
      setNoteDialog({ id: buildingId, status: newStatus });
      setNoteText("");
    } else if (confirmPref) {
      setConfirmAction({ id: buildingId, status: newStatus });
    } else {
      updateStatus(buildingId, newStatus);
    }
  };

  const updateStatus = async (id: string, status: string, notes?: string) => {
    setSaving(true);
    const update: Record<string, unknown> = {
      inspection_status: status,
      completion_date: status === "complete" ? new Date().toISOString() : null,
    };
    if (notes !== undefined) update.inspector_notes = notes;

    const { error } = await supabase.from("buildings").update(update).eq("id", id);
    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success(`Updated to ${STATUS_CONFIG[status]?.label || status}`);
      setDays((prev) =>
        prev.map((d) => ({
          ...d,
          buildings: d.buildings.map((b) =>
            b.id === id
              ? { ...b, inspection_status: status, inspector_notes: (notes ?? b.inspector_notes) }
              : b
          ),
        }))
      );

      // Auto-advance to next pending building after marking complete
      if (status === "complete") {
        setTimeout(() => {
          setDays(currentDays => {
            const currentDay = currentDays[selectedDayIndex];
            if (currentDay) {
              const currentIdx = currentDay.buildings.findIndex(b => b.id === id);
              const nextPending = currentDay.buildings.find(
                (b, idx) => idx > currentIdx && b.inspection_status !== "complete"
              );
              if (nextPending) {
                setExpandedBuilding(nextPending.id);
              } else {
                setExpandedBuilding(null);
              }
            }
            return currentDays;
          });
        }, 150);
      }
    }
    setSaving(false);
    setNoteDialog(null);
    setNoteText("");
  };

  const handleExport = async (plan: SavedRoutePlan, format: "pdf" | "excel") => {
    setExporting(true);
    try {
      const { data: dayRows } = await supabase
        .from("route_plan_days")
        .select("*")
        .eq("route_plan_id", plan.id)
        .order("day_number");

      if (!dayRows || dayRows.length === 0) {
        toast.error("No route data to export");
        setExporting(false);
        return;
      }

      const daysData: DayData[] = [];
      for (const day of dayRows) {
        const { data: rpb } = await supabase
          .from("route_plan_buildings")
          .select("*, buildings(*)")
          .eq("route_plan_day_id", day.id)
          .order("stop_order");

        const buildings: BuildingData[] = ((rpb || []) as any[]).map((r) => ({
          id: r.building_id,
          stop_order: r.stop_order,
          property_name: r.buildings.property_name,
          address: r.buildings.address,
          city: r.buildings.city,
          state: r.buildings.state,
          zip_code: r.buildings.zip_code,
          square_footage: r.buildings.square_footage,
          roof_group: r.buildings.roof_group,
          building_code: r.buildings.building_code,
          roof_access_type: r.buildings.roof_access_type,
          access_location: r.buildings.access_location,
          lock_gate_codes: r.buildings.lock_gate_codes,
          is_priority: r.buildings.is_priority,
          requires_advance_notice: r.buildings.requires_advance_notice,
          requires_escort: r.buildings.requires_escort,
          special_equipment: r.buildings.special_equipment,
          special_notes: r.buildings.special_notes,
          property_manager_name: r.buildings.property_manager_name,
          property_manager_phone: r.buildings.property_manager_phone,
          property_manager_email: r.buildings.property_manager_email,
        }));

        daysData.push({
          day_number: day.day_number,
          day_date: day.day_date,
          estimated_distance_miles: day.estimated_distance_miles ? Number(day.estimated_distance_miles) : null,
          buildings,
        });
      }

      const meta: DocumentMetadata = {
        clientName: (plan.clients as any)?.name || "Client",
        regionName: (plan.regions as any)?.name || "Region",
        inspectorName: (plan.inspectors as any)?.name || "Inspector",
        startDate: daysData[0]?.day_date || new Date().toISOString().split("T")[0],
        endDate: daysData[daysData.length - 1]?.day_date || new Date().toISOString().split("T")[0],
      };

      const safeName = ((plan.inspectors as any)?.name || "Schedule").replace(/[^a-zA-Z0-9]/g, "_");

      if (format === "pdf") {
        const pdf = generateInspectorPDF(daysData, meta);
        pdf.save(`${safeName}_Schedule.pdf`);
      } else {
        const wb = generateInspectorExcel(daysData, meta);
        XLSX.writeFile(wb, `${safeName}_Schedule.xlsx`);
      }

      toast.success(`${format.toUpperCase()} exported successfully`);
    } catch (err: any) {
      console.error(err);
      toast.error(`Export failed: ${err.message}`);
    }
    setExporting(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    // Delete route_plan_buildings, days, then plan
    const { data: dayRows } = await supabase
      .from("route_plan_days")
      .select("id")
      .eq("route_plan_id", deleteTarget.id);
    if (dayRows && dayRows.length > 0) {
      await supabase.from("route_plan_buildings").delete().in("route_plan_day_id", dayRows.map((d) => d.id));
      await supabase.from("route_plan_days").delete().eq("route_plan_id", deleteTarget.id);
    }
    await supabase.from("route_plans").delete().eq("id", deleteTarget.id);
    toast.success("Route deleted");
    setDeleteTarget(null);
    setExpandedPlan(null);
    loadPlans();
  };

  const handleLocationSort = async () => {
    setLocationLoading(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      });
      setUserLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
      setLocationSort(true);
      toast.success("Location found — buildings sorted by distance");
    } catch {
      toast.error("Unable to get your location. Please enable location services.");
    }
    setLocationLoading(false);
  };

  const sortedByDistance = useMemo(() => {
    if (!locationSort || !userLocation) return [];
    const all = days.flatMap((day) =>
      day.buildings.map((b) => ({
        ...b,
        dayNumber: day.day_number,
        dayId: day.id,
      }))
    );
    const withDistance = all.map((b) => {
      const dist =
        b.latitude != null && b.longitude != null
          ? haversineDistance(userLocation.lat, userLocation.lng, b.latitude, b.longitude)
          : null;
      return { ...b, distanceMiles: dist };
    });
    if (priorityFirst) {
      const priorities = withDistance.filter((b) => b.is_priority).sort((a, b) => (a.distanceMiles ?? 999) - (b.distanceMiles ?? 999));
      const nonPriorities = withDistance.filter((b) => !b.is_priority).sort((a, b) => (a.distanceMiles ?? 999) - (b.distanceMiles ?? 999));
      return [...priorities, ...nonPriorities];
    }
    return withDistance.sort((a, b) => (a.distanceMiles ?? 999) - (b.distanceMiles ?? 999));
  }, [locationSort, userLocation, days, priorityFirst]);

  const handleBulkComplete = async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    const ids = Array.from(selectedIds);

    const { error } = await supabase
      .from("buildings")
      .update({
        inspection_status: "complete",
        completion_date: new Date().toISOString(),
      })
      .in("id", ids);

    if (error) {
      toast.error("Failed to update buildings");
    } else {
      toast.success(`${ids.length} building${ids.length > 1 ? "s" : ""} marked complete`);
      setDays((prev) =>
        prev.map((d) => ({
          ...d,
          buildings: d.buildings.map((b) =>
            selectedIds.has(b.id)
              ? { ...b, inspection_status: "complete" }
              : b
          ),
        }))
      );
    }
    setSelectedIds(new Set());
    setBulkMode(false);
    setSaving(false);
  };

  const allBuildings = days.flatMap((d) => d.buildings);
  const totalComplete = allBuildings.filter((b) => b.inspection_status === "complete").length;

  if (loading) return null;
  if (plans.length === 0) return null;

  return (
    <>
      {/* Hidden batch CAD file input */}
      <input
        ref={batchCadInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        multiple
        className="hidden"
        onChange={onBatchCadFileChange}
      />
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Saved Routes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {plans.map((plan) => {
            const isExpanded = expandedPlan === plan.id;
            return (
              <div key={plan.id} className="border border-border rounded-lg overflow-hidden">
                <button
                  className="w-full text-left p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                  onClick={() => toggleExpand(plan.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{plan.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {(plan.clients as any)?.name} • {(plan.regions as any)?.name} • {(plan.inspectors as any)?.name || "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <span className="text-xs text-muted-foreground">{new Date(plan.created_at).toLocaleDateString()}</span>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-4">
                    {loadingDays ? (
                      <div className="flex justify-center py-6">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : days.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No days in this route.</p>
                    ) : (
                      <>
                        {/* Overall progress + hide toggle */}
                        <div className="flex items-center gap-3">
                          <Progress value={allBuildings.length > 0 ? (totalComplete / allBuildings.length) * 100 : 0} className="h-2 flex-1" />
                          <span className="text-sm font-medium text-muted-foreground">{totalComplete}/{allBuildings.length} complete</span>
                        </div>
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Switch id={`hide-complete-${expandedPlan}`} checked={hideComplete} onCheckedChange={setHideComplete} />
                            <Label htmlFor={`hide-complete-${expandedPlan}`} className="text-xs cursor-pointer">Hide completed</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch id={`needs-cad-${expandedPlan}`} checked={needsCadFilter} onCheckedChange={setNeedsCadFilter} />
                            <Label htmlFor={`needs-cad-${expandedPlan}`} className="text-xs cursor-pointer">Needs CAD</Label>
                          </div>
                        </div>

                        {/* Batch CAD Upload */}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={cadProcessing}
                          onClick={() => batchCadInputRef.current?.click()}
                        >
                          {cadProcessing ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Camera className="h-4 w-4 mr-1" />
                          )}
                          {cadProcessing ? "Processing CADs…" : "Upload CADs"}
                        </Button>

                        {/* Location sort controls */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant={locationSort ? "default" : "outline"}
                            onClick={handleLocationSort}
                            disabled={locationLoading}
                          >
                            {locationLoading ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Crosshair className="h-4 w-4 mr-1" />
                            )}
                            {locationSort ? "Sorted by Location" : "Sort by Location"}
                          </Button>
                          {locationSort && (
                            <>
                              <div className="flex items-center gap-1.5">
                                <Checkbox
                                  id="priority-first"
                                  checked={priorityFirst}
                                  onCheckedChange={(v) => setPriorityFirst(!!v)}
                                />
                                <Label htmlFor="priority-first" className="text-xs cursor-pointer">
                                  Priority first
                                </Label>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { setLocationSort(false); setUserLocation(null); }}
                              >
                                Back to Days
                              </Button>
                            </>
                          )}
                        </div>

                        {locationSort && userLocation ? (
                          /* Proximity-sorted view */
                          <div className="space-y-1">
                            {sortedByDistance
                              .filter((b) => {
                                if (hideComplete && b.inspection_status === "complete") return false;
                                if (needsCadFilter && !(b.inspection_status === "complete" && !b.photo_url)) return false;
                                return true;
                              })
                              .map((b) => {
                                const cfg = STATUS_CONFIG[b.inspection_status] || STATUS_CONFIG.pending;
                                const isBuildingExpanded = expandedBuilding === b.id;
                                return (
                                  <div key={b.id} className={`rounded-md bg-background border border-border overflow-hidden ${b.inspection_status === "complete" ? "opacity-50" : ""}`}>
                                    <button
                                      className="w-full text-left p-3"
                                      onClick={() => setExpandedBuilding(isBuildingExpanded ? null : b.id)}
                                    >
                                      {/* Row 1: name, priority, status, distance */}
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          <span className="text-sm font-medium truncate">{b.property_name}</span>
                                          {b.is_priority && <Badge variant="destructive" className="text-[10px] px-1 py-0">P</Badge>}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0 ml-2">
                                          <Badge className={`${cfg.badge} border-0 text-[10px]`}>{cfg.label}</Badge>
                                          {b.photo_url && <Badge className="bg-primary/20 text-primary border-0 text-[10px] px-1">CAD</Badge>}
                                          {b.distanceMiles != null ? (
                                            <span className="text-xs font-medium text-primary">
                                              {b.distanceMiles < 1
                                                ? `${(b.distanceMiles * 5280).toFixed(0)} ft`
                                                : `${b.distanceMiles.toFixed(1)} mi`}
                                            </span>
                                          ) : (
                                            <span className="text-[10px] text-muted-foreground">No coords</span>
                                          )}
                                          {isBuildingExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                                        </div>
                                      </div>
                                      {/* Row 2: address + day label */}
                                      <div className="flex items-center justify-between mt-1">
                                        <span className="text-xs text-muted-foreground truncate">{b.address}, {b.city}</span>
                                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">Day {b.dayNumber}</span>
                                      </div>
                                      {/* Row 3: access code + sq ft */}
                                      {(b.lock_gate_codes || b.square_footage) && (
                                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                          {b.lock_gate_codes && (
                                            <span className="text-xs font-mono font-bold text-primary">🔑 {b.lock_gate_codes}</span>
                                          )}
                                          {b.square_footage && (
                                            <span className="text-[10px] text-muted-foreground">{b.square_footage.toLocaleString()} SF</span>
                                          )}
                                        </div>
                                      )}
                                      {/* Warning badges */}
                                      {(b.requires_advance_notice || b.requires_escort) && (
                                        <div className="flex gap-1.5 mt-1.5">
                                          {b.requires_advance_notice && (
                                            <Badge className="bg-warning/20 text-warning border-warning/30 text-[10px] px-1.5 py-0">24HR NOTICE</Badge>
                                          )}
                                          {b.requires_escort && (
                                            <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px] px-1.5 py-0">ESCORT REQ</Badge>
                                          )}
                                        </div>
                                      )}
                                    </button>
                                    {/* Quick actions — always visible, no expand needed */}
                                    <div className="flex items-center gap-2 px-3 pb-3 pt-2 border-t border-border/50">
                                      <Button size="sm" variant="outline" className="h-9 px-3 flex-1"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openNavigation(b.address, b.city, b.state, b.zip_code);
                                        }}>
                                        <Navigation className="h-4 w-4 mr-1.5" /> Navigate
                                      </Button>
                                      {b.inspection_status !== "complete" ? (
                                        <Button size="sm"
                                          className="h-9 px-4 bg-success text-success-foreground hover:bg-success/90"
                                          disabled={saving}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleStatusChange(b.id, "complete");
                                          }}>
                                          <Check className="h-4 w-4 mr-1.5" /> Done
                                        </Button>
                                      ) : (
                                        <Button size="sm" variant="outline"
                                          className="h-9 px-3 border-success/30 text-success hover:bg-success/10"
                                          disabled={saving}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleStatusChange(b.id, "pending");
                                          }}>
                                          <Undo2 className="h-3.5 w-3.5 mr-1" /> Undo
                                        </Button>
                                      )}
                                    </div>
                                    {isBuildingExpanded && (
                                      <div className="px-3 pb-3 border-t border-border pt-3 space-y-3 text-xs">
                                        <div className="text-sm text-muted-foreground">
                                          {b.address}, {b.city}, {b.state} {b.zip_code}
                                        </div>
                                        {(b.access_location || b.lock_gate_codes || b.roof_access_type) && (
                                          <div className="p-2.5 rounded-lg bg-accent/50 space-y-1.5">
                                            <div className="font-semibold text-foreground text-xs uppercase tracking-wider">Access Details</div>
                                            {b.access_location && <div className="text-foreground leading-relaxed">{b.access_location}</div>}
                                            {b.lock_gate_codes && (
                                              <div className="flex items-center gap-1.5">
                                                <span className="text-muted-foreground">Codes:</span>
                                                <span className="font-mono font-bold text-primary text-sm">{b.lock_gate_codes}</span>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        {b.special_equipment && b.special_equipment.length > 0 && (
                                          <div className="flex items-start gap-1.5">
                                            <span className="text-muted-foreground">Equipment:</span>
                                            <span className="text-foreground">{b.special_equipment.join(", ")}</span>
                                          </div>
                                        )}
                                        {b.special_notes && (
                                          <div className="p-2 rounded bg-muted">
                                            <span className="text-muted-foreground">Notes: </span>
                                            <span className="text-foreground">{b.special_notes}</span>
                                          </div>
                                        )}
                                        {(b.property_manager_name || b.property_manager_phone || b.property_manager_email) && (
                                          <div className="p-2.5 rounded-lg bg-accent/50 space-y-1">
                                            <div className="font-semibold text-foreground text-xs uppercase tracking-wider">Property Manager</div>
                                            {b.property_manager_name && <div className="text-foreground">{b.property_manager_name}</div>}
                                            {b.property_manager_phone && (
                                              <div><a href={`tel:${b.property_manager_phone}`} className="text-primary underline">{b.property_manager_phone}</a></div>
                                            )}
                                            {b.property_manager_email && (
                                              <div><a href={`mailto:${b.property_manager_email}`} className="text-primary underline">{b.property_manager_email}</a></div>
                                            )}
                                          </div>
                                        )}
                                        {b.inspector_notes && (
                                          <div className="p-2 rounded bg-muted">
                                            <span className="text-muted-foreground">Inspector Notes: </span>
                                            <span className="text-foreground">{b.inspector_notes}</span>
                                          </div>
                                        )}
                                        <Button
                                          variant="outline"
                                          className="w-full"
                                          onClick={(e) => { e.stopPropagation(); openNavigation(b.address, b.city, b.state, b.zip_code); }}
                                        >
                                          <Navigation className="h-4 w-4 mr-2" /> Navigate
                                        </Button>
                                        <Button
                                          variant="outline"
                                          className="w-full"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setMoveTarget({ buildingId: b.id, fromDayId: b.dayId, fromDayNumber: b.dayNumber });
                                          }}
                                        >
                                          <ArrowRightLeft className="h-4 w-4 mr-2" /> Move to Another Day
                                        </Button>
                                        {/* CAD View */}
                                        {b.photo_url && (
                                          <Button
                                            variant="outline"
                                            className="w-full"
                                            onClick={(e) => { e.stopPropagation(); setCadPreview(b.photo_url); }}
                                          >
                                            <ImageIcon className="h-4 w-4 mr-2" /> View CAD
                                          </Button>
                                        )}
                                        <div className="grid grid-cols-3 gap-2 pt-1">
                                          <Button
                                            className={`h-12 flex-col gap-1 border ${
                                              b.inspection_status === "complete"
                                                ? "bg-success/30 text-success border-success/50 ring-2 ring-success/30"
                                                : "bg-success/10 text-success border-success/30 hover:bg-success/20"
                                            }`}
                                            variant="ghost"
                                            disabled={saving}
                                            onClick={(e) => { e.stopPropagation(); handleStatusChange(b.id, "complete"); }}
                                          >
                                            <Check className="h-5 w-5" />
                                            <span className="text-[11px]">Done</span>
                                          </Button>
                                          <Button
                                            className={`h-12 flex-col gap-1 border ${
                                              b.inspection_status === "skipped"
                                                ? "bg-warning/30 text-warning border-warning/50 ring-2 ring-warning/30"
                                                : "bg-warning/10 text-warning border-warning/30 hover:bg-warning/20"
                                            }`}
                                            variant="ghost"
                                            disabled={saving}
                                            onClick={(e) => { e.stopPropagation(); handleStatusChange(b.id, "skipped"); }}
                                          >
                                            <SkipForward className="h-5 w-5" />
                                            <span className="text-[11px]">Skip</span>
                                          </Button>
                                          <Button
                                            className={`h-12 flex-col gap-1 border ${
                                              b.inspection_status === "needs_revisit"
                                                ? "bg-destructive/30 text-destructive border-destructive/50 ring-2 ring-destructive/30"
                                                : "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"
                                            }`}
                                            variant="ghost"
                                            disabled={saving}
                                            onClick={(e) => { e.stopPropagation(); handleStatusChange(b.id, "needs_revisit"); }}
                                          >
                                            <AlertTriangle className="h-5 w-5" />
                                            <span className="text-[11px]">Revisit</span>
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        ) : (
                          <>
                        {/* Day picker chips */}
                        <div ref={dayPickerRef} className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                          {days.map((day, idx) => {
                            const dayComplete = day.buildings.filter(b => b.inspection_status === "complete").length;
                            const dayTotal = day.buildings.length;
                            const isAllComplete = dayComplete === dayTotal && dayTotal > 0;
                            const isSelected = idx === selectedDayIndex;
                            return (
                              <button
                                key={day.id}
                                onClick={() => setSelectedDayIndex(idx)}
                                className={`flex-shrink-0 min-w-[80px] px-3 py-2 rounded-lg border text-center transition-colors ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : isAllComplete
                                    ? "bg-muted/50 border-border opacity-60"
                                    : "bg-background border-border hover:border-primary/50"
                                }`}
                              >
                                <div className="text-xs font-semibold">
                                  {isAllComplete && <Check className="h-3 w-3 inline mr-1" />}
                                  Day {day.day_number}
                                </div>
                                <div className="text-[10px] opacity-80 mt-0.5">{dayComplete}/{dayTotal}</div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Day summary bar */}
                        {days[selectedDayIndex] && (() => {
                          const day = days[selectedDayIndex];
                          const dayBuildings = day.buildings;
                          const completeCount = dayBuildings.filter(b => b.inspection_status === "complete").length;
                          const advanceNoticeCount = dayBuildings.filter(b => b.requires_advance_notice).length;
                          const escortCount = dayBuildings.filter(b => b.requires_escort).length;
                          const equipmentCount = dayBuildings.filter(b => b.special_equipment && b.special_equipment.length > 0).length;
                          const visibleBuildings = dayBuildings.filter(b => {
                            if (hideComplete && b.inspection_status === "complete") return false;
                            if (needsCadFilter && !(b.inspection_status === "complete" && !b.photo_url)) return false;
                            return true;
                          });
                          return (
                            <div className="space-y-2">
                              <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-1">
                                <div className="flex items-center gap-2 text-sm flex-wrap">
                                  <span className="font-semibold">Day {day.day_number}</span>
                                  <span className="text-muted-foreground">·</span>
                                  <span className="text-muted-foreground">{dayBuildings.length} stops</span>
                                  {day.estimated_distance_miles && (
                                    <>
                                      <span className="text-muted-foreground">·</span>
                                      <span className="text-muted-foreground">~{day.estimated_distance_miles} mi</span>
                                    </>
                                  )}
                                  <span className="text-muted-foreground">·</span>
                                  <span className="text-muted-foreground">{completeCount}/{dayBuildings.length} complete</span>
                                  <Button
                                    size="sm"
                                    variant={bulkMode ? "default" : "outline"}
                                    onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()); }}
                                    className="ml-auto"
                                  >
                                    {bulkMode ? "Cancel" : "Select"}
                                  </Button>
                                </div>
                                {(advanceNoticeCount > 0 || escortCount > 0 || equipmentCount > 0) && (
                                  <div className="flex gap-2 flex-wrap">
                                    {advanceNoticeCount > 0 && (
                                      <Badge className="bg-warning/20 text-warning border-warning/30 text-[10px]">
                                        ⚠️ {advanceNoticeCount} needs 24hr notice
                                      </Badge>
                                    )}
                                    {escortCount > 0 && (
                                      <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px]">
                                        👤 {escortCount} requires escort
                                      </Badge>
                                    )}
                                    {equipmentCount > 0 && (
                                      <Badge className="bg-info/20 text-info border-info/30 text-[10px]">
                                        🔧 {equipmentCount} needs equipment
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                              {visibleBuildings.length === 0 && hideComplete ? (
                                <p className="text-xs text-muted-foreground text-center py-2">All buildings complete for this day.</p>
                              ) : (
                              <div className="space-y-1">
                                {bulkMode && (
                                  <div className="flex items-center gap-3 text-xs pb-1">
                                    <button
                                      className="text-primary underline"
                                      onClick={() => {
                                        const visible = visibleBuildings.filter(b => b.inspection_status !== "complete").map(b => b.id);
                                        setSelectedIds(new Set(visible));
                                      }}
                                    >
                                      Select all incomplete
                                    </button>
                                    <button
                                      className="text-primary underline"
                                      onClick={() => setSelectedIds(new Set())}
                                    >
                                      Deselect all
                                    </button>
                                    <span className="text-muted-foreground">{selectedIds.size} selected</span>
                                  </div>
                                )}
                                {visibleBuildings.map((b) => {
                                  const cfg = STATUS_CONFIG[b.inspection_status] || STATUS_CONFIG.pending;
                                  const isBuildingExpanded = !bulkMode && expandedBuilding === b.id;
                                  const isSelected = selectedIds.has(b.id);
                                  return (
                                    <div key={b.id} className={`rounded-md bg-background border overflow-hidden ${b.inspection_status === "complete" ? "opacity-50" : ""} ${bulkMode && isSelected ? "border-primary" : "border-border"}`}>
                                      <button
                                        className="w-full text-left p-3"
                                        onClick={() => {
                                          if (bulkMode) {
                                            setSelectedIds(prev => {
                                              const next = new Set(prev);
                                              if (next.has(b.id)) next.delete(b.id);
                                              else next.add(b.id);
                                              return next;
                                            });
                                          } else {
                                            setExpandedBuilding(isBuildingExpanded ? null : b.id);
                                          }
                                        }}
                                      >
                                        {/* Row 1: Stop number, name, badges, status, chevron */}
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2 min-w-0 flex-1">
                                            {bulkMode && (
                                              <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => {
                                                  setSelectedIds(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(b.id)) next.delete(b.id);
                                                    else next.add(b.id);
                                                    return next;
                                                  });
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                              />
                                            )}
                                            <span className="text-xs text-muted-foreground font-mono">#{b.stop_order}</span>
                                            <span className="text-sm font-medium truncate">{b.property_name}</span>
                                            {b.is_priority && <Badge variant="destructive" className="text-[10px] px-1 py-0">P</Badge>}
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0 ml-2">
                                            <Badge className={`${cfg.badge} border-0 text-[10px]`}>{cfg.label}</Badge>
                                            {b.photo_url && <Badge className="bg-primary/20 text-primary border-0 text-[10px] px-1">CAD</Badge>}
                                            {isBuildingExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                                          </div>
                                        </div>
                                        {/* Row 2: Address */}
                                        <div className="text-xs text-muted-foreground mt-1 truncate">
                                          {b.address}, {b.city}
                                        </div>
                                        {/* Row 3: Access code + roof type + sq ft */}
                                        {(b.lock_gate_codes || b.roof_access_type || b.square_footage) && (
                                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                            {b.lock_gate_codes && (
                                              <span className="text-xs font-mono font-bold text-primary">🔑 {b.lock_gate_codes}</span>
                                            )}
                                            {b.roof_access_type && (
                                              <span className="text-[10px] text-muted-foreground">
                                                {b.roof_access_type === "roof_hatch" ? "Roof hatch" :
                                                 b.roof_access_type === "exterior_ladder" ? "Ext. ladder" :
                                                 b.roof_access_type === "interior_ladder" ? "Int. ladder" :
                                                 b.roof_access_type === "ground_level" ? "Ground level" :
                                                 b.roof_access_type.replace(/_/g, " ")}
                                              </span>
                                            )}
                                            {b.square_footage && (
                                              <span className="text-[10px] text-muted-foreground">{b.square_footage.toLocaleString()} SF</span>
                                            )}
                                          </div>
                                        )}
                                        {/* Row 4: Warning badges */}
                                        {(b.requires_advance_notice || b.requires_escort) && (
                                          <div className="flex gap-1.5 mt-1.5">
                                            {b.requires_advance_notice && (
                                              <Badge className="bg-warning/20 text-warning border-warning/30 text-[10px] px-1.5 py-0">24HR NOTICE</Badge>
                                            )}
                                            {b.requires_escort && (
                                              <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px] px-1.5 py-0">ESCORT REQ</Badge>
                                            )}
                                          </div>
                                        )}
                                      </button>
                                      {/* Quick actions — always visible, hidden in bulk mode */}
                                      {!bulkMode && (
                                        <div className="flex items-center gap-2 px-3 pb-3 pt-2 border-t border-border/50">
                                          <Button size="sm" variant="outline" className="h-9 px-3 flex-1"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openNavigation(b.address, b.city, b.state, b.zip_code);
                                            }}>
                                            <Navigation className="h-4 w-4 mr-1.5" /> Navigate
                                          </Button>
                                          {b.inspection_status !== "complete" ? (
                                            <Button size="sm"
                                              className="h-9 px-4 bg-success text-success-foreground hover:bg-success/90"
                                              disabled={saving}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleStatusChange(b.id, "complete");
                                              }}>
                                              <Check className="h-4 w-4 mr-1.5" /> Done
                                            </Button>
                                          ) : (
                                            <Button size="sm" variant="outline"
                                              className="h-9 px-3 border-success/30 text-success hover:bg-success/10"
                                              disabled={saving}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleStatusChange(b.id, "pending");
                                              }}>
                                              <Undo2 className="h-3.5 w-3.5 mr-1" /> Undo
                                            </Button>
                                          )}
                                        </div>
                                      )}
                                      {isBuildingExpanded && (
                                        <div className="px-3 pb-3 border-t border-border pt-3 space-y-3 text-xs">
                                          {/* Full address */}
                                          <div className="text-sm text-muted-foreground">
                                            {b.address}, {b.city}, {b.state} {b.zip_code}
                                          </div>

                                          {/* Access Details */}
                                          {(b.access_location || b.lock_gate_codes || b.roof_access_type) && (
                                            <div className="p-2.5 rounded-lg bg-accent/50 space-y-1.5">
                                              <div className="font-semibold text-foreground text-xs uppercase tracking-wider">Access Details</div>
                                              {b.access_location && (
                                                <div className="text-foreground leading-relaxed">{b.access_location}</div>
                                              )}
                                              {b.lock_gate_codes && (
                                                <div className="flex items-center gap-1.5">
                                                  <span className="text-muted-foreground">Codes:</span>
                                                  <span className="font-mono font-bold text-primary text-sm">{b.lock_gate_codes}</span>
                                                </div>
                                              )}
                                            </div>
                                          )}

                                          {/* Equipment */}
                                          {b.special_equipment && b.special_equipment.length > 0 && (
                                            <div className="flex items-start gap-1.5">
                                              <span className="text-muted-foreground">Equipment:</span>
                                              <span className="text-foreground">{b.special_equipment.join(", ")}</span>
                                            </div>
                                          )}

                                          {/* Special notes */}
                                          {b.special_notes && (
                                            <div className="p-2 rounded bg-muted">
                                              <span className="text-muted-foreground">Notes: </span>
                                              <span className="text-foreground">{b.special_notes}</span>
                                            </div>
                                          )}

                                          {/* Property Manager */}
                                          {(b.property_manager_name || b.property_manager_phone || b.property_manager_email) && (
                                            <div className="p-2.5 rounded-lg bg-accent/50 space-y-1">
                                              <div className="font-semibold text-foreground text-xs uppercase tracking-wider">Property Manager</div>
                                              {b.property_manager_name && <div className="text-foreground">{b.property_manager_name}</div>}
                                              {b.property_manager_phone && (
                                                <div>
                                                  <a href={`tel:${b.property_manager_phone}`} className="text-primary underline">{b.property_manager_phone}</a>
                                                </div>
                                              )}
                                              {b.property_manager_email && (
                                                <div>
                                                  <a href={`mailto:${b.property_manager_email}`} className="text-primary underline">{b.property_manager_email}</a>
                                                </div>
                                              )}
                                            </div>
                                          )}

                                          {/* Inspector notes */}
                                          {b.inspector_notes && (
                                            <div className="p-2 rounded bg-muted">
                                              <span className="text-muted-foreground">Inspector Notes: </span>
                                              <span className="text-foreground">{b.inspector_notes}</span>
                                            </div>
                                          )}

                                          {/* Navigate button */}
                                          <Button
                                            variant="outline"
                                            className="w-full"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openNavigation(b.address, b.city, b.state, b.zip_code);
                                            }}
                                          >
                                            <Navigation className="h-4 w-4 mr-2" /> Navigate
                                          </Button>

                                          {/* Move to another day */}
                                          <Button
                                            variant="outline"
                                            className="w-full"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setMoveTarget({ buildingId: b.id, fromDayId: day.id, fromDayNumber: day.day_number });
                                            }}
                                          >
                                            <ArrowRightLeft className="h-4 w-4 mr-2" /> Move to Another Day
                                          </Button>

                                          {/* CAD View */}
                                          {b.photo_url && (
                                            <Button
                                              variant="outline"
                                              className="w-full"
                                              onClick={(e) => { e.stopPropagation(); setCadPreview(b.photo_url); }}
                                            >
                                              <ImageIcon className="h-4 w-4 mr-2" /> View CAD
                                            </Button>
                                          )}

                                          {/* Status tap buttons */}
                                          <div className="grid grid-cols-3 gap-2 pt-1">
                                            <Button
                                              className={`h-12 flex-col gap-1 border ${
                                                b.inspection_status === "complete"
                                                  ? "bg-success/30 text-success border-success/50 ring-2 ring-success/30"
                                                  : "bg-success/10 text-success border-success/30 hover:bg-success/20"
                                              }`}
                                              variant="ghost"
                                              disabled={saving}
                                              onClick={(e) => { e.stopPropagation(); handleStatusChange(b.id, "complete"); }}
                                            >
                                              <Check className="h-5 w-5" />
                                              <span className="text-[11px]">Done</span>
                                            </Button>
                                            <Button
                                              className={`h-12 flex-col gap-1 border ${
                                                b.inspection_status === "skipped"
                                                  ? "bg-warning/30 text-warning border-warning/50 ring-2 ring-warning/30"
                                                  : "bg-warning/10 text-warning border-warning/30 hover:bg-warning/20"
                                              }`}
                                              variant="ghost"
                                              disabled={saving}
                                              onClick={(e) => { e.stopPropagation(); handleStatusChange(b.id, "skipped"); }}
                                            >
                                              <SkipForward className="h-5 w-5" />
                                              <span className="text-[11px]">Skip</span>
                                            </Button>
                                            <Button
                                              className={`h-12 flex-col gap-1 border ${
                                                b.inspection_status === "needs_revisit"
                                                  ? "bg-destructive/30 text-destructive border-destructive/50 ring-2 ring-destructive/30"
                                                  : "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"
                                              }`}
                                              variant="ghost"
                                              disabled={saving}
                                              onClick={(e) => { e.stopPropagation(); handleStatusChange(b.id, "needs_revisit"); }}
                                            >
                                              <AlertTriangle className="h-5 w-5" />
                                              <span className="text-[11px]">Revisit</span>
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                {bulkMode && selectedIds.size > 0 && (
                                  <div className="sticky bottom-0 left-0 right-0 p-3 bg-background border-t border-border flex items-center justify-between gap-3 z-10">
                                    <span className="text-sm font-medium">{selectedIds.size} selected</span>
                                    <Button
                                      className="bg-success text-success-foreground hover:bg-success/90"
                                      disabled={saving}
                                      onClick={handleBulkComplete}
                                    >
                                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                                      Mark Complete
                                    </Button>
                                  </div>
                                )}
                              </div>
                              )}
                            </div>
                          );
                        })()}
                          </>
                        )}
                      </>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" disabled={exporting} onClick={() => handleExport(plan, "pdf")}>
                        {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />} Export PDF
                      </Button>
                      <Button size="sm" variant="outline" disabled={exporting} onClick={() => handleExport(plan, "excel")}>
                        {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />} Export Excel
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(plan)}>
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Note dialog */}
      <Dialog open={!!noteDialog} onOpenChange={(o) => !o && setNoteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {noteDialog?.status === "skipped" ? "Why was this skipped?" : "What needs revisiting?"}
            </DialogTitle>
          </DialogHeader>
          <Textarea placeholder="Enter notes (required)..." value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialog(null)}>Cancel</Button>
            <Button disabled={!noteText.trim() || saving} onClick={() => { if (noteDialog) updateStatus(noteDialog.id, noteDialog.status, noteText.trim()); }}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this route?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.name}" and all its day/building assignments. Building status data is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move building dialog */}
      <Dialog open={!!moveTarget} onOpenChange={(o) => !o && setMoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Building to Another Day</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {days
              .filter((d) => moveTarget && d.id !== moveTarget.fromDayId)
              .map((d) => (
                <Button
                  key={d.id}
                  variant="outline"
                  className="w-full justify-between"
                  disabled={moving}
                  onClick={() => handleMoveBuilding(d.id, d.day_number)}
                >
                  <span>Day {d.day_number}</span>
                  <span className="text-xs text-muted-foreground">{d.buildings.length} buildings</span>
                </Button>
              ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveTarget(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CAD Preview dialog */}
      <Dialog open={!!cadPreview} onOpenChange={(o) => !o && setCadPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>CAD Drawing</DialogTitle>
            <DialogDescription>Uploaded CAD screenshot</DialogDescription>
          </DialogHeader>
          {cadPreview && (
            <img src={cadPreview} alt="CAD Drawing" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm status change dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Status Change</AlertDialogTitle>
            <AlertDialogDescription>
              Mark this building as {confirmAction ? STATUS_CONFIG[confirmAction.status]?.label : ""}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmAction) { updateStatus(confirmAction.id, confirmAction.status); setConfirmAction(null); } }}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch CAD confirmation dialog */}
      <Dialog open={cadConfirmOpen} onOpenChange={(o) => { if (!o) { setCadConfirmOpen(false); setCadMatches([]); setCadChecked({}); } }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Verify CAD Matches</DialogTitle>
            <DialogDescription>
              {cadMatches.length} screenshot{cadMatches.length !== 1 ? "s" : ""} processed. Check the buildings to upload and mark complete.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {cadMatches.map((m, i) => (
              <div key={i} className={`p-3 rounded-lg border ${m.confidence === "high" ? "border-success/50 bg-success/5" : m.confidence === "low" ? "border-warning/50 bg-warning/5" : "border-border bg-muted/30"}`}>
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={cadChecked[i] || false}
                    disabled={!m.matchedBuilding}
                    onCheckedChange={(v) => setCadChecked((prev) => ({ ...prev, [i]: !!v }))}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{m.file.name}</div>
                    {m.matchedBuilding ? (
                      <div className="mt-1">
                        <div className="text-sm text-foreground">{m.matchedBuilding.property_name}</div>
                        <div className="text-xs text-muted-foreground">{m.matchedBuilding.address}</div>
                        {m.extractedSF && (
                          <div className="text-xs mt-0.5">
                            <span className="text-muted-foreground">Detected SF: </span>
                            <span className="font-medium">{m.extractedSF.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground mt-1">No building match found</div>
                    )}
                    <Badge className={`mt-1.5 text-[10px] ${m.confidence === "high" ? "bg-success/20 text-success" : m.confidence === "low" ? "bg-warning/20 text-warning" : "bg-muted text-muted-foreground"} border-0`}>
                      {m.confidence === "high" ? "High confidence" : m.confidence === "low" ? "Low confidence" : "No match"}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCadConfirmOpen(false); setCadMatches([]); setCadChecked({}); }}>
              Cancel
            </Button>
            <Button
              disabled={cadSaving || Object.values(cadChecked).filter(Boolean).length === 0}
              onClick={confirmBatchCadUpload}
            >
              {cadSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Upload {Object.values(cadChecked).filter(Boolean).length} CAD{Object.values(cadChecked).filter(Boolean).length !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
