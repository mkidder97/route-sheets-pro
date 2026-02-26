import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  ArrowLeft,
  Pencil,
  AlertTriangle,
  ShieldCheck,
  MapPin,
  ExternalLink,
  Loader2,
  Phone,
  Mail,
  Building2,
  FileText,
  Clock,
  Wrench,
} from "lucide-react";
import RoofSpecsTab from "@/components/building/RoofSpecsTab";
import type { Tables } from "@/integrations/supabase/types";

interface BuildingRow extends Tables<"buildings"> {
  clients?: { name: string } | null;
  regions?: { name: string } | null;
  inspectors?: { name: string } | null;
}

interface CampaignBuildingRow {
  id: string;
  campaign_id: string;
  building_id: string;
  inspection_status: string;
  completion_date: string | null;
  inspector_id: string | null;
  inspection_campaigns?: { name: string; inspection_type: string } | null;
  inspectors?: { name: string } | null;
}

export default function BuildingDetail() {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const canWrite = role === "admin" || role === "office_manager";

  const [building, setBuilding] = useState<BuildingRow | null>(null);
  const [history, setHistory] = useState<CampaignBuildingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  // Notes state
  const [specialNotes, setSpecialNotes] = useState("");
  const [inspectorNotes, setInspectorNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    loadBuilding();
    loadHistory();
  }, [id]);

  const loadBuilding = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("buildings")
      .select("*, clients(name), regions(name), inspectors(name)")
      .eq("id", id!)
      .maybeSingle();
    setBuilding(data as BuildingRow | null);
    if (data) {
      setSpecialNotes(data.special_notes || "");
      setInspectorNotes(data.inspector_notes || "");
    }
    setLoading(false);
  };

  const loadHistory = async () => {
    const { data } = await supabase
      .from("campaign_buildings")
      .select("*, inspection_campaigns(name, inspection_type), inspectors(name)")
      .eq("building_id", id!)
      .order("created_at", { ascending: false });
    if (data) setHistory(data as unknown as CampaignBuildingRow[]);
  };

  const openEdit = () => {
    if (!building) return;
    setEditData({
      property_name: building.property_name,
      address: building.address,
      city: building.city,
      state: building.state,
      zip_code: building.zip_code,
      building_code: building.building_code || "",
      roof_group: building.roof_group || "",
      square_footage: building.square_footage || "",
      install_year: building.install_year || "",
      roof_system: building.roof_system || "",
      manufacturer: building.manufacturer || "",
      is_priority: building.is_priority || false,
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!building) return;
    setSaving(true);
    const update = {
      property_name: editData.property_name as string,
      address: editData.address as string,
      city: editData.city as string,
      state: editData.state as string,
      zip_code: editData.zip_code as string,
      building_code: (editData.building_code as string) || null,
      roof_group: (editData.roof_group as string) || null,
      square_footage: editData.square_footage ? Number(editData.square_footage) : null,
      install_year: editData.install_year ? Number(editData.install_year) : null,
      roof_system: (editData.roof_system as string) || null,
      manufacturer: (editData.manufacturer as string) || null,
      is_priority: editData.is_priority as boolean,
    };
    const { error } = await supabase.from("buildings").update(update).eq("id", building.id);
    if (error) {
      toast.error("Failed to save changes");
    } else {
      toast.success("Building updated");
      setEditOpen(false);
      loadBuilding();
    }
    setSaving(false);
  };

  const handleGeocode = async () => {
    if (!building) return;
    setGeocoding(true);
    try {
      const addr = `${building.address}, ${building.city}, ${building.state} ${building.zip_code}`;
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
      );
      const data = await res.json();
      const loc = data.results?.[0]?.geometry?.location;
      if (loc) {
        await supabase
          .from("buildings")
          .update({ latitude: loc.lat, longitude: loc.lng })
          .eq("id", building.id);
        setBuilding({ ...building, latitude: loc.lat, longitude: loc.lng });
        toast.success("Address geocoded successfully");
      } else {
        toast.error("Could not geocode address");
      }
    } catch {
      toast.error("Geocoding failed");
    }
    setGeocoding(false);
  };

  const saveNote = async (field: "special_notes" | "inspector_notes") => {
    if (!building) return;
    setSavingNotes(field);
    const value = field === "special_notes" ? specialNotes : inspectorNotes;
    const { error } = await supabase
      .from("buildings")
      .update({ [field]: value || null })
      .eq("id", building.id);
    if (error) {
      toast.error("Failed to save note");
    } else {
      toast.success("Note saved");
      setBuilding({ ...building, [field]: value || null });
    }
    setSavingNotes(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!building) {
    return (
      <div className="text-center py-20">
        <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
        <h2 className="text-xl font-semibold mb-2">Building not found</h2>
        <Link to="/buildings" className="text-primary hover:underline">
          Back to Buildings
        </Link>
      </div>
    );
  }

  const clientName = (building.clients as any)?.name;
  const regionName = (building.regions as any)?.name;
  const inspectorName = (building.inspectors as any)?.name;

  // Contact helpers
  const hasPM = building.property_manager_name || building.property_manager_phone || building.property_manager_mobile || building.property_manager_email;
  const hasAM = building.asset_manager_name || building.asset_manager_phone || building.asset_manager_email;
  const hasSC = building.site_contact || building.site_contact_office_phone || building.site_contact_mobile_phone || building.site_contact_email;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Link to="/buildings">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold truncate">{building.property_name}</h1>
            <p className="text-sm text-muted-foreground">
              {building.address}, {building.city}, {building.state} {building.zip_code}
            </p>
          </div>
          {canWrite && (
            <Button variant="outline" size="sm" onClick={openEdit}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 ml-11">
          {clientName && <Badge variant="secondary">{clientName}</Badge>}
          {regionName && <Badge variant="outline">{regionName}</Badge>}
          {building.is_priority && (
            <Badge className="bg-warning/20 text-warning border-warning/30">Priority</Badge>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="w-full flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="roofspecs">Roof Specs</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Facts */}
          <Card>
            <CardHeader><CardTitle className="text-base">Key Facts</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                <Fact label="Building Code" value={building.building_code} />
                <Fact label="Roof Group" value={building.roof_group} />
                <Fact label="Square Footage" value={building.square_footage?.toLocaleString()} />
                <Fact label="Install Year" value={building.install_year?.toString()} />
                <Fact label="Roof System" value={building.roof_system} />
                <Fact label="Manufacturer" value={building.manufacturer} />
                <Fact label="Inspector" value={inspectorName} />
              </div>
            </CardContent>
          </Card>

          {/* Roof Access */}
          {(building.roof_access_type || building.roof_access_description || building.access_location || building.lock_gate_codes) && (
            <Card>
              <CardHeader><CardTitle className="text-base">Roof Access</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <Fact label="Access Type" value={building.roof_access_type?.replace(/_/g, " ")} />
                  <Fact label="Description" value={building.roof_access_description} />
                  <Fact label="Location" value={building.access_location} />
                  <Fact label="Lock/Gate Codes" value={building.lock_gate_codes} mono />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Flags */}
          {(building.requires_advance_notice || building.requires_escort) && (
            <Card>
              <CardHeader><CardTitle className="text-base">Flags</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-4">
                {building.requires_advance_notice && (
                  <div className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <span>Requires Advance Notice</span>
                  </div>
                )}
                {building.requires_escort && (
                  <div className="flex items-center gap-2 text-sm">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span>Requires Escort</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Special Equipment */}
          {building.special_equipment && building.special_equipment.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Special Equipment</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {building.special_equipment.map((item, i) => (
                    <Badge key={i} variant="secondary"><Wrench className="h-3 w-3 mr-1" />{item}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Special Notes */}
          {building.special_notes && (
            <Card>
              <CardHeader><CardTitle className="text-base">Special Notes</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{building.special_notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Map */}
          <Card>
            <CardHeader><CardTitle className="text-base">Location</CardTitle></CardHeader>
            <CardContent>
              {building.latitude && building.longitude ? (
                <a
                  href={`https://www.google.com/maps?q=${building.latitude},${building.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm">
                    <MapPin className="h-4 w-4 mr-1" /> Open in Google Maps
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </a>
              ) : (
                <Button variant="outline" size="sm" onClick={handleGeocode} disabled={geocoding}>
                  {geocoding ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <MapPin className="h-4 w-4 mr-1" />}
                  Geocode Address
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Contacts */}
        <TabsContent value="contacts" className="space-y-4">
          {!hasPM && !hasAM && !hasSC ? (
            <div className="text-center py-12 text-muted-foreground">
              <Phone className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No contact information available.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {hasPM && (
                <ContactCard
                  title="Property Manager"
                  name={building.property_manager_name}
                  phone={building.property_manager_phone}
                  mobile={building.property_manager_mobile}
                  email={building.property_manager_email}
                />
              )}
              {hasAM && (
                <ContactCard
                  title="Asset Manager"
                  name={building.asset_manager_name}
                  phone={building.asset_manager_phone}
                  email={building.asset_manager_email}
                />
              )}
              {hasSC && (
                <ContactCard
                  title="Site Contact"
                  name={building.site_contact}
                  phone={building.site_contact_office_phone}
                  mobile={building.site_contact_mobile_phone}
                  email={building.site_contact_email}
                />
              )}
            </div>
          )}
        </TabsContent>

        {/* Tab 3: Inspection History */}
        <TabsContent value="history">
          {history.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No inspection history for this building.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Inspector</TableHead>
                    <TableHead>Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>
                        <Link
                          to={`/inspections/campaigns/${h.campaign_id}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {(h.inspection_campaigns as any)?.name || "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm capitalize">
                        {(h.inspection_campaigns as any)?.inspection_type || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs capitalize">
                          {h.inspection_status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {(h.inspectors as any)?.name || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {h.completion_date || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Tab 4: Notes */}
        <TabsContent value="notes" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Special Notes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={specialNotes}
                onChange={(e) => setSpecialNotes(e.target.value)}
                disabled={!canWrite}
                placeholder="Add special notes…"
                rows={4}
              />
              {canWrite && (
                <Button
                  size="sm"
                  onClick={() => saveNote("special_notes")}
                  disabled={savingNotes === "special_notes"}
                >
                  {savingNotes === "special_notes" && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Save
                </Button>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Inspector Notes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={inspectorNotes}
                onChange={(e) => setInspectorNotes(e.target.value)}
                disabled={!canWrite}
                placeholder="Add inspector notes…"
                rows={4}
              />
              {canWrite && (
                <Button
                  size="sm"
                  onClick={() => saveNote("inspector_notes")}
                  disabled={savingNotes === "inspector_notes"}
                >
                  {savingNotes === "inspector_notes" && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Save
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Roof Specs */}
        <TabsContent value="roofspecs">
          <RoofSpecsTab buildingId={building.id} canWrite={canWrite} isAdmin={role === "admin"} />
        </TabsContent>

        {/* Tab 6: Documents stub */}
        <TabsContent value="documents">
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-lg font-medium">Coming Soon</p>
            <p className="text-sm">Document management will be available here.</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Building</DialogTitle>
            <DialogDescription>Update the building details below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <EditField label="Property Name" field="property_name" data={editData} setData={setEditData} />
            <EditField label="Address" field="address" data={editData} setData={setEditData} />
            <div className="grid grid-cols-3 gap-3">
              <EditField label="City" field="city" data={editData} setData={setEditData} />
              <EditField label="State" field="state" data={editData} setData={setEditData} />
              <EditField label="Zip" field="zip_code" data={editData} setData={setEditData} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <EditField label="Building Code" field="building_code" data={editData} setData={setEditData} />
              <EditField label="Roof Group" field="roof_group" data={editData} setData={setEditData} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <EditField label="Square Footage" field="square_footage" data={editData} setData={setEditData} type="number" />
              <EditField label="Install Year" field="install_year" data={editData} setData={setEditData} type="number" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <EditField label="Roof System" field="roof_system" data={editData} setData={setEditData} />
              <EditField label="Manufacturer" field="manufacturer" data={editData} setData={setEditData} />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={editData.is_priority as boolean}
                onCheckedChange={(v) => setEditData({ ...editData, is_priority: v })}
              />
              <Label>Priority Building</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper components
function Fact({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={`font-medium ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
    </div>
  );
}

function ContactCard({
  title,
  name,
  phone,
  mobile,
  email,
}: {
  title: string;
  name?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {name && <p className="font-medium">{name}</p>}
        {phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3 w-3 text-muted-foreground" />
            <a href={`tel:${phone}`} className="text-primary hover:underline">{phone}</a>
          </div>
        )}
        {mobile && (
          <div className="flex items-center gap-2">
            <Phone className="h-3 w-3 text-muted-foreground" />
            <a href={`tel:${mobile}`} className="text-primary hover:underline">{mobile}</a>
            <span className="text-xs text-muted-foreground">(mobile)</span>
          </div>
        )}
        {email && (
          <div className="flex items-center gap-2">
            <Mail className="h-3 w-3 text-muted-foreground" />
            <a href={`mailto:${email}`} className="text-primary hover:underline">{email}</a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EditField({
  label,
  field,
  data,
  setData,
  type = "text",
}: {
  label: string;
  field: string;
  data: Record<string, unknown>;
  setData: (d: Record<string, unknown>) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={(data[field] as string) ?? ""}
        onChange={(e) => setData({ ...data, [field]: e.target.value })}
      />
    </div>
  );
}
