import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const getSetting = (key: string, fallback: string) =>
  localStorage.getItem(key) ?? fallback;

interface Inspector {
  id: string;
  name: string;
  regions: { name: string } | null;
}

export default function Settings() {
  const hasToasted = useRef(false);

  // Inspector Profile
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [selectedInspector, setSelectedInspector] = useState(
    getSetting("roofroute_inspector_id", "")
  );

  // Route Defaults
  const [buildingsPerDay, setBuildingsPerDay] = useState(
    Number(getSetting("roofroute_default_buildings_per_day", "5"))
  );
  const [startLocation, setStartLocation] = useState(
    getSetting("roofroute_default_start_location", "")
  );

  // PDF Preferences
  const [companyName, setCompanyName] = useState(
    getSetting("roofroute_company_name", "")
  );
  const [includeCodes, setIncludeCodes] = useState(
    getSetting("roofroute_include_codes_in_pdf", "true") === "true"
  );
  const [fontSize, setFontSize] = useState(
    getSetting("roofroute_pdf_font_size", "standard")
  );

  useEffect(() => {
    supabase
      .from("inspectors")
      .select("id, name, regions(name)")
      .order("name")
      .then(({ data }) => {
        if (data) setInspectors(data as unknown as Inspector[]);
      });
  }, []);

  const saveSetting = (key: string, value: string) => {
    localStorage.setItem(key, value);
    if (!hasToasted.current) {
      toast.success("Settings saved");
      hasToasted.current = true;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Customize your experience</p>
      </div>

      {/* Inspector Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Inspector Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Your Name</Label>
            <Select
              value={selectedInspector}
              onValueChange={(val) => {
                setSelectedInspector(val);
                saveSetting("roofroute_inspector_id", val);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an inspector" />
              </SelectTrigger>
              <SelectContent>
                {inspectors.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                    {i.regions ? ` — ${i.regions.name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              This determines which routes appear on your My Routes page.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Route Generation Defaults */}
      <Card>
        <CardHeader>
          <CardTitle>Route Generation Defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Default buildings per day: {buildingsPerDay}</Label>
            <Slider
              min={3}
              max={8}
              step={1}
              value={[buildingsPerDay]}
              onValueChange={([val]) => {
                setBuildingsPerDay(val);
                saveSetting("roofroute_default_buildings_per_day", String(val));
              }}
            />
            <p className="text-xs text-muted-foreground">
              Pre-fills the buildings per day slider when generating new routes.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Home base / starting location</Label>
            <Input
              placeholder="Zip code or address"
              value={startLocation}
              onChange={(e) => {
                setStartLocation(e.target.value);
                saveSetting("roofroute_default_start_location", e.target.value);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Pre-fills the starting location in Route Builder. Leave blank to skip.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* PDF Export Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>PDF Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Company name</Label>
            <Input
              placeholder="Your company name"
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                saveSetting("roofroute_company_name", e.target.value);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Appears in the header of exported PDF route sheets.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Include access codes in PDF</Label>
              <p className="text-xs text-muted-foreground">
                Turn off when sharing route sheets with property managers who shouldn't see lock codes.
              </p>
            </div>
            <Switch
              checked={includeCodes}
              onCheckedChange={(val) => {
                setIncludeCodes(val);
                saveSetting("roofroute_include_codes_in_pdf", String(val));
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>PDF font size</Label>
            <Select
              value={fontSize}
              onValueChange={(val) => {
                setFontSize(val);
                saveSetting("roofroute_pdf_font_size", val);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Large font is easier to read on phones in the field.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
