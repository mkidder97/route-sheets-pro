import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SavedRoutes from "@/components/SavedRoutes";

interface InspectorOption {
  id: string;
  name: string;
  regionName: string | null;
}

export default function MyRoutes() {
  const [inspectors, setInspectors] = useState<InspectorOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInspectors = async () => {
      const { data } = await supabase
        .from("inspectors")
        .select("id, name, regions(name)")
        .order("name");
      const options: InspectorOption[] = ((data as any[]) || []).map((i) => ({
        id: i.id,
        name: i.name,
        regionName: i.regions?.name ?? null,
      }));
      setInspectors(options);
      setLoading(false);
    };
    fetchInspectors();
  }, []);

  const selected = inspectors.find((i) => i.id === selectedId);
  const subtitle = selected
    ? `${selected.name}${selected.regionName ? ` — ${selected.regionName}` : ""}`
    : "Your daily inspection routes";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Routes</h1>
        <p className="text-muted-foreground text-sm">{subtitle}</p>
      </div>

      <div className="max-w-sm">
        <Select
          value={selectedId}
          onValueChange={setSelectedId}
          disabled={loading}
        >
          <SelectTrigger>
            <SelectValue placeholder={loading ? "Loading…" : "Select your name"} />
          </SelectTrigger>
          <SelectContent>
            {inspectors.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.name}{i.regionName ? ` — ${i.regionName}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedId ? (
        <SavedRoutes inspectorId={selectedId} />
      ) : (
        <p className="text-muted-foreground text-sm py-8 text-center">
          Select your name above to view your routes.
        </p>
      )}
    </div>
  );
}
