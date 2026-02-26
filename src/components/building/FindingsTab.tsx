import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  FileText,
  Loader2,
  Pencil,
  Plus,
  X,
} from "lucide-react";

interface Finding {
  id: string;
  building_id: string;
  inspection_date: string;
  narrative: string | null;
  is_in_progress: boolean | null;
  inspector_id: string | null;
  campaign_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  inspectors: { name: string } | null;
}

interface Inspector {
  id: string;
  name: string;
}

interface Campaign {
  id: string;
  name: string;
}

interface FindingsTabProps {
  buildingId: string;
  canWrite: boolean;
}

export default function FindingsTab({ buildingId, canWrite }: FindingsTabProps) {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editNarrative, setEditNarrative] = useState("");
  const [editInProgress, setEditInProgress] = useState(false);
  const [editInspectorId, setEditInspectorId] = useState<string | null>(null);
  const [editCampaignId, setEditCampaignId] = useState<string | null>(null);

  // Add form state
  const [addDate, setAddDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [addNarrative, setAddNarrative] = useState("");
  const [addInProgress, setAddInProgress] = useState(false);
  const [addInspectorId, setAddInspectorId] = useState<string | null>(null);
  const [addCampaignId, setAddCampaignId] = useState<string | null>(null);

  const loadFindings = useCallback(async () => {
    const { data } = await supabase
      .from("inspection_findings")
      .select("*, inspectors(name)")
      .eq("building_id", buildingId)
      .order("inspection_date", { ascending: false });
    const items = (data || []) as unknown as Finding[];
    setFindings(items);
    if (items.length > 0 && !selectedFindingId) {
      setSelectedFindingId(items[0].id);
    }
    setLoading(false);
  }, [buildingId, selectedFindingId]);

  const loadInspectors = useCallback(async () => {
    const { data } = await supabase
      .from("inspectors")
      .select("id, name")
      .order("name");
    if (data) setInspectors(data);
  }, []);

  const loadCampaigns = useCallback(async () => {
    const { data } = await supabase
      .from("campaign_buildings")
      .select("campaign_id, inspection_campaigns(id, name)")
      .eq("building_id", buildingId);
    if (data) {
      const seen = new Set<string>();
      const list: Campaign[] = [];
      for (const row of data) {
        const camp = (row as any).inspection_campaigns;
        if (camp && !seen.has(camp.id)) {
          seen.add(camp.id);
          list.push({ id: camp.id, name: camp.name });
        }
      }
      setCampaigns(list);
    }
  }, [buildingId]);

  useEffect(() => {
    loadFindings();
    loadInspectors();
    loadCampaigns();
  }, [loadFindings, loadInspectors, loadCampaigns]);

  const selectedFinding = findings.find((f) => f.id === selectedFindingId) || null;

  const openEdit = () => {
    if (!selectedFinding) return;
    setEditNarrative(selectedFinding.narrative || "");
    setEditInProgress(selectedFinding.is_in_progress || false);
    setEditInspectorId(selectedFinding.inspector_id);
    setEditCampaignId(selectedFinding.campaign_id);
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
  };

  const saveEdit = async () => {
    if (!selectedFinding) return;
    setSaving(true);
    const { error } = await supabase
      .from("inspection_findings")
      .update({
        narrative: editNarrative || null,
        is_in_progress: editInProgress,
        inspector_id: editInspectorId,
        campaign_id: editCampaignId,
      })
      .eq("id", selectedFinding.id);
    if (error) {
      toast.error("Failed to save finding");
    } else {
      toast.success("Finding updated");
      setEditMode(false);
      await loadFindings();
    }
    setSaving(false);
  };

  const openAdd = () => {
    setAddDate(format(new Date(), "yyyy-MM-dd"));
    setAddNarrative("");
    setAddInProgress(false);
    setAddInspectorId(null);
    setAddCampaignId(null);
    setAddMode(true);
  };

  const cancelAdd = () => {
    setAddMode(false);
  };

  const saveAdd = async () => {
    if (!addDate) {
      toast.error("Inspection date is required");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("inspection_findings")
      .insert({
        building_id: buildingId,
        inspection_date: addDate,
        narrative: addNarrative || null,
        is_in_progress: addInProgress,
        inspector_id: addInspectorId,
        campaign_id: addCampaignId,
      })
      .select("id")
      .single();
    if (error) {
      toast.error("Failed to add finding");
    } else {
      toast.success("Finding added");
      setAddMode(false);
      setSelectedFindingId(data.id);
      await loadFindings();
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Empty state
  if (findings.length === 0 && !addMode) {
    return (
      <div className="text-center py-16 text-slate-500">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
        <p className="text-lg font-medium text-slate-400">No inspection findings yet</p>
        {canWrite && (
          <Button className="mt-4" size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" /> Add First Finding
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-4 min-h-[400px]">
      {/* Date Sidebar */}
      <div className="w-40 flex-shrink-0 space-y-1">
        {findings.map((f) => (
          <button
            key={f.id}
            onClick={() => {
              setSelectedFindingId(f.id);
              setEditMode(false);
              setAddMode(false);
            }}
            className={`w-full text-left text-sm font-medium py-2 px-3 rounded-md flex items-center gap-2 transition-colors ${
              f.id === selectedFindingId
                ? "bg-primary text-white"
                : "text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            }`}
          >
            {f.is_in_progress && (
              <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
            )}
            <span>{format(parseISO(f.inspection_date), "MMM d, yyyy")}</span>
          </button>
        ))}
        {canWrite && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-slate-400 hover:text-slate-200 mt-2"
            onClick={openAdd}
          >
            <Plus className="h-4 w-4 mr-1" /> Add Finding
          </Button>
        )}
      </div>

      {/* Right Panel */}
      <div className="flex-1 rounded-xl bg-slate-800 border border-slate-700/50 p-5 relative">
        {addMode ? (
          /* Add Finding Form */
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-100">New Finding</h3>
            <div className="space-y-1">
              <Label className="text-xs text-slate-400">Inspection Date</Label>
              <Input
                type="date"
                value={addDate}
                onChange={(e) => setAddDate(e.target.value)}
                className="bg-slate-900 border-slate-600"
                required
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={addInProgress} onCheckedChange={setAddInProgress} />
              <Label className="text-sm text-slate-300">In Progress</Label>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-400">Inspector</Label>
              <Select
                value={addInspectorId || ""}
                onValueChange={(v) => setAddInspectorId(v || null)}
              >
                <SelectTrigger className="bg-slate-900 border-slate-600">
                  <SelectValue placeholder="Select inspector" />
                </SelectTrigger>
                <SelectContent>
                  {inspectors.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-400">Campaign</Label>
              <Select
                value={addCampaignId || ""}
                onValueChange={(v) => setAddCampaignId(v || null)}
              >
                <SelectTrigger className="bg-slate-900 border-slate-600">
                  <SelectValue placeholder="Select campaign" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-400">Narrative</Label>
              <Textarea
                value={addNarrative}
                onChange={(e) => setAddNarrative(e.target.value)}
                className="min-h-[200px] font-mono text-sm bg-slate-900 border-slate-600"
                placeholder="Describe findings…"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveAdd} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Save Finding
              </Button>
              <Button size="sm" variant="outline" onClick={cancelAdd}>
                Cancel
              </Button>
            </div>
          </div>
        ) : selectedFinding ? (
          editMode ? (
            /* Edit Mode */
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Narrative</Label>
                <Textarea
                  value={editNarrative}
                  onChange={(e) => setEditNarrative(e.target.value)}
                  className="min-h-[300px] font-mono text-sm bg-slate-900 border-slate-600"
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={editInProgress} onCheckedChange={setEditInProgress} />
                <Label className="text-sm text-slate-300">In Progress</Label>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Inspector</Label>
                <Select
                  value={editInspectorId || ""}
                  onValueChange={(v) => setEditInspectorId(v || null)}
                >
                  <SelectTrigger className="bg-slate-900 border-slate-600">
                    <SelectValue placeholder="Select inspector" />
                  </SelectTrigger>
                  <SelectContent>
                    {inspectors.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Campaign</Label>
                <Select
                  value={editCampaignId || ""}
                  onValueChange={(v) => setEditCampaignId(v || null)}
                >
                  <SelectTrigger className="bg-slate-900 border-slate-600">
                    <SelectValue placeholder="Select campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveEdit} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            /* View Mode */
            <div>
              {canWrite && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 h-8 w-8 text-slate-400 hover:text-slate-200"
                  onClick={openEdit}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}

              {selectedFinding.is_in_progress && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
                  <span className="text-sm text-amber-400">
                    An inspection is currently in progress
                  </span>
                </div>
              )}

              <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                {selectedFinding.narrative || "No narrative recorded."}
              </p>

              <div className="text-xs text-slate-500 flex gap-4 mt-4">
                {selectedFinding.inspectors?.name && (
                  <span>Inspector: {selectedFinding.inspectors.name}</span>
                )}
                {selectedFinding.campaign_id && (
                  <Link
                    to={`/inspections/campaigns/${selectedFinding.campaign_id}`}
                    className="text-primary hover:underline"
                  >
                    View Campaign
                  </Link>
                )}
              </div>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
