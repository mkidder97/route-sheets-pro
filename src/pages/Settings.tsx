import { useRef, useState } from "react";
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
import { toast } from "sonner";

const getSetting = (key: string, fallback: string) =>
  localStorage.getItem(key) ?? fallback;

export default function Settings() {
  const hasToasted = useRef(false);

  // Route Defaults
  const [buildingsPerDay, setBuildingsPerDay] = useState(
    Number(getSetting("roofroute_default_buildings_per_day", "5"))
  );
  const [startLocation, setStartLocation] = useState(
    getSetting("roofroute_default_start_location", "")
  );

  // Field Preferences
  const [navApp, setNavApp] = useState(
    getSetting("roofroute_nav_app", "auto")
  );
  const [autoHide, setAutoHide] = useState(
    getSetting("roofroute_auto_hide_complete", "false") === "true"
  );
  const [confirmStatus, setConfirmStatus] = useState(
    getSetting("roofroute_confirm_status", "false") === "true"
  );

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

      {/* Route Generation Defaults */}
      <Card>
        <CardHeader>
          <CardTitle>Route Defaults</CardTitle>
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

      {/* Field Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Field Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Preferred navigation app</Label>
            <Select
              value={navApp}
              onValueChange={(val) => {
                setNavApp(val);
                saveSetting("roofroute_nav_app", val);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (detect device)</SelectItem>
                <SelectItem value="google">Google Maps</SelectItem>
                <SelectItem value="apple">Apple Maps</SelectItem>
                <SelectItem value="waze">Waze</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Which navigation app opens when you tap Navigate on a building.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Auto-hide completed buildings</Label>
              <p className="text-xs text-muted-foreground">
                Automatically hide completed buildings when opening a route.
              </p>
            </div>
            <Switch
              checked={autoHide}
              onCheckedChange={(val) => {
                setAutoHide(val);
                saveSetting("roofroute_auto_hide_complete", String(val));
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Confirm before status change</Label>
              <p className="text-xs text-muted-foreground">
                Show a confirmation prompt before marking a building as Done, Skipped, or Revisit to prevent accidental taps.
              </p>
            </div>
            <Switch
              checked={confirmStatus}
              onCheckedChange={(val) => {
                setConfirmStatus(val);
                saveSetting("roofroute_confirm_status", String(val));
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
