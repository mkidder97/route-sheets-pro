import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SavedRoutes from "@/components/SavedRoutes";

interface InspectorOption {
  id: string;
  name: string;
  regionName: string | null;
}

export default function MyRoutes() {
  const navigate = useNavigate();
  const [inspectors, setInspectors] = useState<InspectorOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(() => {
    return localStorage.getItem("roofroute_inspector_id") ?? undefined;
  });

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "roofroute_inspector_id") {
        setSelectedId(e.newValue ?? undefined);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

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
        <h1 className="text-xl sm:text-2xl font-bold">My Routes</h1>
        <p className="text-muted-foreground text-sm">{subtitle}</p>
        {selected && (
          <button
            onClick={() => navigate("/settings")}
            className="text-xs text-muted-foreground hover:text-primary underline"
          >
            Switch inspector
          </button>
        )}
      </div>

      {!selectedId && (
        <Card className="mx-4 sm:mx-0">
          <CardContent className="flex flex-col items-center py-12 text-center space-y-4">
            <h2 className="text-lg font-semibold">Welcome to RoofRoute</h2>
            <p className="text-muted-foreground text-sm max-w-md">
              Set your name in Settings to see your daily inspection routes here.
            </p>
            <Button onClick={() => navigate("/settings")}>
              Go to Settings
            </Button>
          </CardContent>
        </Card>
      )}

      {selectedId && <SavedRoutes inspectorId={selectedId} />}
    </div>
  );
}
