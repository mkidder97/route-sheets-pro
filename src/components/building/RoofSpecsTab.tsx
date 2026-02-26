import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus,
  Pencil,
  Trash2,
  Layers,
  ChevronDown,
  Loader2,
  Sun,
  DollarSign,
  ShieldCheck,
  Droplets,
  Camera,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type RoofSection = Tables<"roof_sections">;
type AssemblyLayer = Tables<"roof_assembly_layers">;

interface RoofSpecsTabProps {
  buildingId: string;
  canWrite: boolean;
  isAdmin: boolean;
}

const LAYER_TYPES = ["Membrane", "Insulation", "Deck", "Vapor Barrier"];

export default function RoofSpecsTab({ buildingId, canWrite, isAdmin }: RoofSpecsTabProps) {
  const [sections, setSections] = useState<RoofSection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layers, setLayers] = useState<AssemblyLayer[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState("Roof A");
  const [editSummaryOpen, setEditSummaryOpen] = useState(false);
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);
  const [editAssemblyOpen, setEditAssemblyOpen] = useState(false);
  const [editCapitalOpen, setEditCapitalOpen] = useState(false);
  const [layerDialogOpen, setLayerDialogOpen] = useState(false);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState<{ sectionId: string; type: 'core' | 'section' } | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null);
  const corePhotoRef = useRef<HTMLInputElement>(null);
  const sectionPhotoRef = useRef<HTMLInputElement>(null);

  // Form data
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [layerForm, setLayerForm] = useState<Record<string, any>>({});

  const selected = sections.find((s) => s.id === selectedId) || null;

  const loadSections = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("roof_sections")
      .select("*")
      .eq("building_id", buildingId)
      .order("section_name");
    const list = data || [];
    setSections(list);
    if (list.length > 0 && !list.find((s) => s.id === selectedId)) {
      setSelectedId(list[0].id);
    }
    if (list.length === 0) setSelectedId(null);
    setLoading(false);
  }, [buildingId, selectedId]);

  const loadLayers = useCallback(async (sectionId: string) => {
    const { data } = await supabase
      .from("roof_assembly_layers")
      .select("*")
      .eq("roof_section_id", sectionId)
      .order("sort_order");
    setLayers(data || []);
  }, []);

  useEffect(() => {
    loadSections();
  }, [buildingId]);

  useEffect(() => {
    if (selectedId) loadLayers(selectedId);
    else setLayers([]);
  }, [selectedId]);

  // Add section
  const handleAddSection = async () => {
    if (!newSectionName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("roof_sections").insert({
      building_id: buildingId,
      section_name: newSectionName.trim(),
    });
    if (error) toast.error("Failed to add section");
    else {
      toast.success("Section added");
      setAddSectionOpen(false);
      setNewSectionName("Roof A");
      await loadSections();
    }
    setSaving(false);
  };

  // Generic section update
  const updateSection = async (updates: Record<string, any>) => {
    if (!selectedId) return;
    setSaving(true);
    const { error } = await supabase.from("roof_sections").update(updates).eq("id", selectedId);
    if (error) toast.error("Failed to save");
    else {
      toast.success("Saved");
      await loadSections();
    }
    setSaving(false);
  };

  // Save summary
  const saveSummary = async () => {
    await updateSection({
      section_name: formData.section_name,
      roof_area_sqft: formData.roof_area_sqft ? Number(formData.roof_area_sqft) : null,
      year_installed: formData.year_installed ? Number(formData.year_installed) : null,
      replacement_year: formData.replacement_year ? Number(formData.replacement_year) : null,
      rating: formData.rating ? Number(formData.rating) : null,
      manufacturer: formData.manufacturer || null,
      installing_contractor: formData.installing_contractor || null,
      repairing_contractor: formData.repairing_contractor || null,
      has_manufacturer_warranty: formData.has_manufacturer_warranty || false,
      warranty_issued_by: formData.warranty_issued_by || null,
      warranty_guarantee_number: formData.warranty_guarantee_number || null,
      warranty_expiration_date: formData.warranty_expiration_date || null,
      has_contractor_warranty: formData.has_contractor_warranty || false,
      contractor_warranty_expiration: formData.contractor_warranty_expiration || null,
    });
    setEditSummaryOpen(false);
  };

  // Save details
  const saveDetails = async () => {
    await updateSection({
      roof_system: formData.roof_system || null,
      system_description: formData.system_description || null,
      lttr_value: formData.lttr_value ? Number(formData.lttr_value) : null,
      perimeter_detail: formData.perimeter_detail || null,
      flashing_detail: formData.flashing_detail || null,
      drainage_system: formData.drainage_system || null,
    });
    setEditDetailsOpen(false);
  };

  // Save assembly recover fields
  const saveAssembly = async () => {
    await updateSection({
      has_recover: formData.has_recover || false,
      recover_type: formData.recover_type || null,
      year_originally_installed: formData.year_originally_installed ? Number(formData.year_originally_installed) : null,
    });
    setEditAssemblyOpen(false);
  };

  // Save capital
  const saveCapital = async () => {
    await updateSection({
      capital_expense_amount: formData.capital_expense_amount ? Number(formData.capital_expense_amount) : null,
      capital_expense_per_sqft: formData.capital_expense_per_sqft ? Number(formData.capital_expense_per_sqft) : null,
      capital_expense_type: formData.capital_expense_type || null,
      capital_expense_year: formData.capital_expense_year ? Number(formData.capital_expense_year) : null,
      maintenance_budget_amount: formData.maintenance_budget_amount ? Number(formData.maintenance_budget_amount) : null,
      maintenance_budget_source_date: formData.maintenance_budget_source_date || null,
      has_solar: formData.has_solar || false,
      has_daylighting: formData.has_daylighting || false,
    });
    setEditCapitalOpen(false);
  };

  // Layer CRUD
  const openAddLayer = () => {
    setEditingLayerId(null);
    setLayerForm({ layer_type: "Membrane", description: "", attachment_method: "", thickness: "" });
    setLayerDialogOpen(true);
  };

  const openEditLayer = (layer: AssemblyLayer) => {
    setEditingLayerId(layer.id);
    setLayerForm({
      layer_type: layer.layer_type || "Membrane",
      description: layer.description || "",
      attachment_method: layer.attachment_method || "",
      thickness: layer.thickness || "",
    });
    setLayerDialogOpen(true);
  };

  const saveLayer = async () => {
    if (!selectedId) return;
    setSaving(true);
    if (editingLayerId) {
      const { error } = await supabase.from("roof_assembly_layers").update({
        layer_type: layerForm.layer_type,
        description: layerForm.description || null,
        attachment_method: layerForm.attachment_method || null,
        thickness: layerForm.thickness || null,
      }).eq("id", editingLayerId);
      if (error) toast.error("Failed to update layer");
      else toast.success("Layer updated");
    } else {
      const maxOrder = layers.length > 0 ? Math.max(...layers.map((l) => l.sort_order)) + 1 : 0;
      const { error } = await supabase.from("roof_assembly_layers").insert({
        roof_section_id: selectedId,
        layer_type: layerForm.layer_type,
        description: layerForm.description || null,
        attachment_method: layerForm.attachment_method || null,
        thickness: layerForm.thickness || null,
        sort_order: maxOrder,
      });
      if (error) toast.error("Failed to add layer");
      else toast.success("Layer added");
    }
    setLayerDialogOpen(false);
    await loadLayers(selectedId);
    setSaving(false);
  };

  const deleteLayer = async (layerId: string) => {
    setSaving(true);
    const { error } = await supabase.from("roof_assembly_layers").delete().eq("id", layerId);
    if (error) toast.error("Failed to delete layer");
    else {
      toast.success("Layer deleted");
      if (selectedId) await loadLayers(selectedId);
    }
    setSaving(false);
  };

  // Photo upload handler
  const handlePhotoUpload = async (file: File, sectionId: string, type: 'core' | 'section') => {
    setUploadingPhoto({ sectionId, type });
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const prefix = type === 'core' ? 'core' : 'section';
      const path = `${buildingId}/roof-sections/${sectionId}/${prefix}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('building-files').upload(path, file);
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from('building-files').getPublicUrl(path);
      const col = type === 'core' ? 'core_photo_url' : 'roof_section_photo_url';
      const { error: updateErr } = await supabase.from('roof_sections').update({ [col]: publicUrl }).eq('id', sectionId);
      if (updateErr) throw updateErr;
      toast.success(`${type === 'core' ? 'Core' : 'Section'} photo uploaded`);
      await loadSections();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploadingPhoto(null);
      if (corePhotoRef.current) corePhotoRef.current.value = '';
      if (sectionPhotoRef.current) sectionPhotoRef.current.value = '';
    }
  };

  // Toggle is_live (admin only, immediate)
  const toggleIsLive = async (val: boolean) => {
    if (!selectedId) return;
    const { error } = await supabase.from("roof_sections").update({ is_live: val }).eq("id", selectedId);
    if (error) toast.error("Failed to update");
    else await loadSections();
  };

  // Open edit dialogs with pre-populated data
  const openSummaryEdit = () => {
    if (!selected) return;
    setFormData({ ...selected });
    setEditSummaryOpen(true);
  };
  const openDetailsEdit = () => {
    if (!selected) return;
    setFormData({ ...selected });
    setEditDetailsOpen(true);
  };
  const openAssemblyEdit = () => {
    if (!selected) return;
    setFormData({ ...selected });
    setEditAssemblyOpen(true);
  };
  const openCapitalEdit = () => {
    if (!selected) return;
    setFormData({ ...selected });
    setEditCapitalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Empty state
  if (sections.length === 0) {
    return (
      <div className="text-center py-16">
        <Layers className="h-12 w-12 mx-auto mb-4 text-slate-500 opacity-20" />
        <p className="text-lg font-medium text-slate-300">No roof sections yet</p>
        <p className="text-sm text-slate-500 mb-4">Add a section to start tracking roof specs.</p>
        {canWrite && (
          <>
            <Button onClick={() => setAddSectionOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Section
            </Button>
            <AddSectionDialog
              open={addSectionOpen}
              onOpenChange={setAddSectionOpen}
              name={newSectionName}
              setName={setNewSectionName}
              onSave={handleAddSection}
              saving={saving}
            />
          </>
        )}
      </div>
    );
  }

  const remainingLife = selected?.replacement_year ? selected.replacement_year - 2026 : null;
  const warrantyExpired = selected?.warranty_expiration_date
    ? new Date(selected.warranty_expiration_date) < new Date()
    : false;
  const contractorWarrantyExpired = selected?.contractor_warranty_expiration
    ? new Date(selected.contractor_warranty_expiration) < new Date()
    : false;

  return (
    <div className="space-y-4">
      {/* Section pills */}
      <div className="flex flex-wrap items-center gap-2">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedId(s.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              s.id === selectedId
                ? "bg-primary text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            {s.section_name}
          </button>
        ))}
        {canWrite && (
          <button
            onClick={() => setAddSectionOpen(true)}
            className="px-4 py-1.5 rounded-full text-sm font-medium bg-slate-700/50 text-slate-400 hover:bg-slate-600 hover:text-slate-200 transition-colors flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Add Section
          </button>
        )}
      </div>

      {selected && (
        <>
          {/* Card 1: Roof Summary & Warranty */}
          <Collapsible defaultOpen>
            <Card className="bg-slate-800 border-slate-700/50">
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-semibold text-slate-100">Roof Summary & Warranty</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left: Specs */}
                    <div className="grid grid-cols-2 gap-3">
                      <SpecFact label="Section Name" value={selected.section_name} />
                      <SpecFact label="Roof Area (sqft)" value={selected.roof_area_sqft?.toLocaleString()} />
                      <SpecFact label="Year Installed" value={selected.year_installed?.toString()} />
                      <SpecFact label="Replacement Year" value={selected.replacement_year?.toString()} />
                      <SpecFact
                        label="Remaining Life"
                        value={
                          remainingLife !== null
                            ? remainingLife <= 0
                              ? undefined
                              : `${remainingLife} yrs`
                            : undefined
                        }
                        badge={remainingLife !== null && remainingLife <= 0 ? "Expired" : undefined}
                        badgeVariant="destructive"
                      />
                      <SpecFact label="Rating" value={selected.rating ? `${selected.rating} / 10` : undefined} />
                      <SpecFact label="Manufacturer" value={selected.manufacturer} />
                      <SpecFact label="Installing Contractor" value={selected.installing_contractor} />
                      <SpecFact label="Repairing Contractor" value={selected.repairing_contractor} />
                      {isAdmin && (
                        <div>
                          <p className="text-slate-400 text-xs mb-1">Live</p>
                          <Switch
                            checked={selected.is_live || false}
                            onCheckedChange={toggleIsLive}
                          />
                        </div>
                      )}
                    </div>
                    {/* Right: Warranty */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs">Manufacturer Warranty</span>
                        <Badge variant={selected.has_manufacturer_warranty ? "default" : "secondary"} className="text-xs">
                          {selected.has_manufacturer_warranty ? "yes" : "no"}
                        </Badge>
                      </div>
                      <SpecFact label="Issued By" value={selected.warranty_issued_by} />
                      <SpecFact label="Guarantee #" value={selected.warranty_guarantee_number} />
                      <SpecFact
                        label="Warranty Expiration"
                        value={selected.warranty_expiration_date}
                        badge={warrantyExpired ? "Expired" : undefined}
                        badgeVariant="destructive"
                      />
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-slate-400 text-xs">Contractor Warranty</span>
                        <Badge variant={selected.has_contractor_warranty ? "default" : "secondary"} className="text-xs">
                          {selected.has_contractor_warranty ? "yes" : "no"}
                        </Badge>
                      </div>
                      <SpecFact
                        label="Contractor Warranty Exp."
                        value={selected.contractor_warranty_expiration}
                        badge={contractorWarrantyExpired ? "Expired" : undefined}
                        badgeVariant="destructive"
                      />
                    </div>
                  </div>
                  {canWrite && (
                    <div className="flex justify-end mt-3">
                      <Button variant="ghost" size="icon" onClick={openSummaryEdit}>
                        <Pencil className="h-4 w-4 text-slate-400" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Card 2: Roof Details */}
          <Collapsible defaultOpen>
            <Card className="bg-slate-800 border-slate-700/50">
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-slate-100">Roof Details</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-3">
                    <SpecFact label="Roof System" value={selected.roof_system} />
                    <SpecFact label="LTTR Value" value={selected.lttr_value?.toString()} />
                    <div className="col-span-2">
                      <SpecFact label="System Description" value={selected.system_description} />
                    </div>
                    <SpecFact label="Perimeter Detail" value={selected.perimeter_detail} />
                    <SpecFact label="Flashing Detail" value={selected.flashing_detail} />
                    <SpecFact label="Drainage System" value={selected.drainage_system} />
                  </div>
                  {/* Photo thumbnails */}
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-700">
                    <div>
                      <p className="text-slate-400 text-xs mb-2">Core Photo</p>
                      {selected.core_photo_url ? (
                        <img
                          src={selected.core_photo_url}
                          alt="Core photo"
                          className="w-24 h-24 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setPreviewPhoto({ url: selected.core_photo_url!, title: `${selected.section_name} — Core Photo` })}
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-lg bg-slate-700/50 border border-slate-600 flex items-center justify-center">
                          <Camera className="h-6 w-6 text-slate-500" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs mb-2">Section Photo</p>
                      {selected.roof_section_photo_url ? (
                        <img
                          src={selected.roof_section_photo_url}
                          alt="Section photo"
                          className="w-24 h-24 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setPreviewPhoto({ url: selected.roof_section_photo_url!, title: `${selected.section_name} — Section Photo` })}
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-lg bg-slate-700/50 border border-slate-600 flex items-center justify-center">
                          <Camera className="h-6 w-6 text-slate-500" />
                        </div>
                      )}
                    </div>
                  </div>
                  {canWrite && (
                    <div className="flex items-center justify-end gap-2 mt-3">
                      <input type="file" accept="image/*" ref={corePhotoRef} className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && selected) handlePhotoUpload(file, selected.id, 'core');
                      }} />
                      <input type="file" accept="image/*" ref={sectionPhotoRef} className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && selected) handlePhotoUpload(file, selected.id, 'section');
                      }} />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => corePhotoRef.current?.click()}
                        disabled={!!uploadingPhoto}
                      >
                        {uploadingPhoto?.sectionId === selected.id && uploadingPhoto?.type === 'core' ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Camera className="h-4 w-4 mr-1" />
                        )}
                        {selected.core_photo_url ? 'Replace Core Photo' : 'Upload Core Photo'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => sectionPhotoRef.current?.click()}
                        disabled={!!uploadingPhoto}
                      >
                        {uploadingPhoto?.sectionId === selected.id && uploadingPhoto?.type === 'section' ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Camera className="h-4 w-4 mr-1" />
                        )}
                        {selected.roof_section_photo_url ? 'Replace Section Photo' : 'Upload Section Photo'}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={openDetailsEdit}>
                        <Pencil className="h-4 w-4 text-slate-400" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Card 3: Roof Assembly */}
          <Collapsible defaultOpen>
            <Card className="bg-slate-800 border-slate-700/50">
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-cyan-400" />
                    <span className="text-sm font-semibold text-slate-100">Roof Assembly</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  {layers.length === 0 ? (
                    <p className="text-sm text-slate-500 py-2">No assembly layers defined.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-700">
                            <TableHead className="text-xs uppercase tracking-wider text-slate-400">Layer Type</TableHead>
                            <TableHead className="text-xs uppercase tracking-wider text-slate-400">Description</TableHead>
                            <TableHead className="text-xs uppercase tracking-wider text-slate-400">Attachment</TableHead>
                            <TableHead className="text-xs uppercase tracking-wider text-slate-400">Thickness</TableHead>
                            {canWrite && <TableHead className="text-xs uppercase tracking-wider text-slate-400 w-20">Actions</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {layers.map((layer) => (
                            <TableRow key={layer.id} className="border-slate-700 hover:bg-slate-700/50">
                              <TableCell className="text-sm text-white">{layer.layer_type || "—"}</TableCell>
                              <TableCell className="text-sm text-white">{layer.description || "—"}</TableCell>
                              <TableCell className="text-sm text-white">{layer.attachment_method || "—"}</TableCell>
                              <TableCell className="text-sm text-white">{layer.thickness || "—"}</TableCell>
                              {canWrite && (
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditLayer(layer)}>
                                      <Pencil className="h-3.5 w-3.5 text-slate-400" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteLayer(layer.id)}>
                                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {canWrite && (
                    <Button variant="outline" size="sm" className="mt-3" onClick={openAddLayer}>
                      <Plus className="h-4 w-4 mr-1" /> Add Layer
                    </Button>
                  )}
                  {/* Recover fields */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-700">
                    <div>
                      <p className="text-slate-400 text-xs mb-1">Has Recover</p>
                      <Badge variant={selected.has_recover ? "default" : "secondary"} className="text-xs">
                        {selected.has_recover ? "yes" : "no"}
                      </Badge>
                    </div>
                    <SpecFact label="Recover Type" value={selected.recover_type} />
                    <SpecFact label="Year Originally Installed" value={selected.year_originally_installed?.toString()} />
                  </div>
                  {canWrite && (
                    <div className="flex justify-end mt-3">
                      <Button variant="ghost" size="icon" onClick={openAssemblyEdit}>
                        <Pencil className="h-4 w-4 text-slate-400" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Card 4: Capital & Sustainability */}
          <Collapsible defaultOpen>
            <Card className="bg-slate-800 border-slate-700/50">
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-amber-400" />
                    <span className="text-sm font-semibold text-slate-100">Capital & Sustainability</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="grid grid-cols-2 gap-3">
                      <SpecFact label="Capital Expense" value={selected.capital_expense_amount ? `$${Number(selected.capital_expense_amount).toLocaleString()}` : undefined} />
                      <SpecFact label="Per Sqft" value={selected.capital_expense_per_sqft ? `$${Number(selected.capital_expense_per_sqft).toFixed(2)}` : undefined} />
                      <SpecFact label="Expense Type" value={selected.capital_expense_type} />
                      <SpecFact label="Expense Year" value={selected.capital_expense_year?.toString()} />
                      <SpecFact label="Maintenance Budget" value={selected.maintenance_budget_amount ? `$${Number(selected.maintenance_budget_amount).toLocaleString()}` : undefined} />
                      <SpecFact label="Budget Source Date" value={selected.maintenance_budget_source_date} />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Sun className="h-4 w-4 text-yellow-400" />
                        <span className="text-slate-300 text-sm">Solar</span>
                        <Badge variant={selected.has_solar ? "default" : "secondary"} className="text-xs">
                          {selected.has_solar ? "yes" : "no"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <Sun className="h-4 w-4 text-sky-400" />
                        <span className="text-slate-300 text-sm">Daylighting</span>
                        <Badge variant={selected.has_daylighting ? "default" : "secondary"} className="text-xs">
                          {selected.has_daylighting ? "yes" : "no"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {canWrite && (
                    <div className="flex justify-end mt-3">
                      <Button variant="ghost" size="icon" onClick={openCapitalEdit}>
                        <Pencil className="h-4 w-4 text-slate-400" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </>
      )}

      {/* Dialogs */}
      <AddSectionDialog
        open={addSectionOpen}
        onOpenChange={setAddSectionOpen}
        name={newSectionName}
        setName={setNewSectionName}
        onSave={handleAddSection}
        saving={saving}
      />

      {/* Edit Summary Dialog */}
      <Dialog open={editSummaryOpen} onOpenChange={setEditSummaryOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle>Edit Roof Summary & Warranty</DialogTitle>
            <DialogDescription>Update the roof summary and warranty details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <FormField label="Section Name" field="section_name" form={formData} setForm={setFormData} />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Roof Area (sqft)" field="roof_area_sqft" form={formData} setForm={setFormData} type="number" />
              <FormField label="Year Installed" field="year_installed" form={formData} setForm={setFormData} type="number" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Replacement Year" field="replacement_year" form={formData} setForm={setFormData} type="number" />
              <FormField label="Rating (1-10)" field="rating" form={formData} setForm={setFormData} type="number" />
            </div>
            <FormField label="Manufacturer" field="manufacturer" form={formData} setForm={setFormData} />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Installing Contractor" field="installing_contractor" form={formData} setForm={setFormData} />
              <FormField label="Repairing Contractor" field="repairing_contractor" form={formData} setForm={setFormData} />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Switch checked={formData.has_manufacturer_warranty || false} onCheckedChange={(v) => setFormData({ ...formData, has_manufacturer_warranty: v })} />
              <Label className="text-sm">Manufacturer Warranty</Label>
            </div>
            <FormField label="Warranty Issued By" field="warranty_issued_by" form={formData} setForm={setFormData} />
            <FormField label="Guarantee Number" field="warranty_guarantee_number" form={formData} setForm={setFormData} />
            <FormField label="Warranty Expiration" field="warranty_expiration_date" form={formData} setForm={setFormData} type="date" />
            <div className="flex items-center gap-3 pt-2">
              <Switch checked={formData.has_contractor_warranty || false} onCheckedChange={(v) => setFormData({ ...formData, has_contractor_warranty: v })} />
              <Label className="text-sm">Contractor Warranty</Label>
            </div>
            <FormField label="Contractor Warranty Exp." field="contractor_warranty_expiration" form={formData} setForm={setFormData} type="date" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSummaryOpen(false)}>Cancel</Button>
            <Button onClick={saveSummary} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Details Dialog */}
      <Dialog open={editDetailsOpen} onOpenChange={setEditDetailsOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle>Edit Roof Details</DialogTitle>
            <DialogDescription>Update roof system details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <FormField label="Roof System" field="roof_system" form={formData} setForm={setFormData} />
            <FormField label="System Description" field="system_description" form={formData} setForm={setFormData} />
            <FormField label="LTTR Value" field="lttr_value" form={formData} setForm={setFormData} type="number" />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Perimeter Detail" field="perimeter_detail" form={formData} setForm={setFormData} />
              <FormField label="Flashing Detail" field="flashing_detail" form={formData} setForm={setFormData} />
            </div>
            <FormField label="Drainage System" field="drainage_system" form={formData} setForm={setFormData} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDetailsOpen(false)}>Cancel</Button>
            <Button onClick={saveDetails} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Assembly Recover Dialog */}
      <Dialog open={editAssemblyOpen} onOpenChange={setEditAssemblyOpen}>
        <DialogContent className="max-w-sm bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle>Edit Recover Info</DialogTitle>
            <DialogDescription>Update recover fields for this section.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Switch checked={formData.has_recover || false} onCheckedChange={(v) => setFormData({ ...formData, has_recover: v })} />
              <Label className="text-sm">Has Recover</Label>
            </div>
            <FormField label="Recover Type" field="recover_type" form={formData} setForm={setFormData} />
            <FormField label="Year Originally Installed" field="year_originally_installed" form={formData} setForm={setFormData} type="number" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAssemblyOpen(false)}>Cancel</Button>
            <Button onClick={saveAssembly} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Capital Dialog */}
      <Dialog open={editCapitalOpen} onOpenChange={setEditCapitalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle>Edit Capital & Sustainability</DialogTitle>
            <DialogDescription>Update capital expenses and sustainability info.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Capital Expense ($)" field="capital_expense_amount" form={formData} setForm={setFormData} type="number" />
              <FormField label="Per Sqft ($)" field="capital_expense_per_sqft" form={formData} setForm={setFormData} type="number" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Expense Type" field="capital_expense_type" form={formData} setForm={setFormData} />
              <FormField label="Expense Year" field="capital_expense_year" form={formData} setForm={setFormData} type="number" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Maintenance Budget ($)" field="maintenance_budget_amount" form={formData} setForm={setFormData} type="number" />
              <FormField label="Budget Source Date" field="maintenance_budget_source_date" form={formData} setForm={setFormData} type="date" />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Switch checked={formData.has_solar || false} onCheckedChange={(v) => setFormData({ ...formData, has_solar: v })} />
              <Label className="text-sm">Solar</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={formData.has_daylighting || false} onCheckedChange={(v) => setFormData({ ...formData, has_daylighting: v })} />
              <Label className="text-sm">Daylighting</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCapitalOpen(false)}>Cancel</Button>
            <Button onClick={saveCapital} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Layer Dialog */}
      <Dialog open={layerDialogOpen} onOpenChange={setLayerDialogOpen}>
        <DialogContent className="max-w-sm bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle>{editingLayerId ? "Edit Layer" : "Add Layer"}</DialogTitle>
            <DialogDescription>Configure the assembly layer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-400">Layer Type</Label>
              <Select value={layerForm.layer_type || ""} onValueChange={(v) => setLayerForm({ ...layerForm, layer_type: v })}>
                <SelectTrigger className="bg-slate-900 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LAYER_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <FormField label="Description" field="description" form={layerForm} setForm={setLayerForm} />
            <FormField label="Attachment Method" field="attachment_method" form={layerForm} setForm={setLayerForm} />
            <FormField label="Thickness" field="thickness" form={layerForm} setForm={setLayerForm} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLayerDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveLayer} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo Preview Dialog */}
      <Dialog open={!!previewPhoto} onOpenChange={() => setPreviewPhoto(null)}>
        <DialogContent className="max-w-2xl bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle>{previewPhoto?.title}</DialogTitle>
          </DialogHeader>
          {previewPhoto && (
            <img src={previewPhoto.url} alt={previewPhoto.title} className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sub-components
function SpecFact({
  label,
  value,
  badge,
  badgeVariant,
}: {
  label: string;
  value?: string | null;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
}) {
  return (
    <div>
      <p className="text-slate-400 text-xs">{label}</p>
      <div className="flex items-center gap-2">
        <p className="text-white font-medium text-sm">{value || "—"}</p>
        {badge && (
          <Badge variant={badgeVariant || "destructive"} className="text-xs">
            {badge}
          </Badge>
        )}
      </div>
    </div>
  );
}

function FormField({
  label,
  field,
  form,
  setForm,
  type = "text",
}: {
  label: string;
  field: string;
  form: Record<string, any>;
  setForm: (f: Record<string, any>) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-slate-400">{label}</Label>
      <Input
        type={type}
        className="bg-slate-900 border-slate-600"
        value={form[field] ?? ""}
        onChange={(e) => setForm({ ...form, [field]: e.target.value })}
      />
    </div>
  );
}

function AddSectionDialog({
  open,
  onOpenChange,
  name,
  setName,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  name: string;
  setName: (v: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle>Add Roof Section</DialogTitle>
          <DialogDescription>Enter a name for the new roof section.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label className="text-xs text-slate-400">Section Name</Label>
          <Input
            className="bg-slate-900 border-slate-600"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Roof A"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
