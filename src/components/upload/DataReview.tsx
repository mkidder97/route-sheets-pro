import { ParsedBuilding } from "@/lib/spreadsheet-parser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Building2, MapPin, Users, Clock, Shield, Wrench } from "lucide-react";

interface DataReviewProps {
  buildings: ParsedBuilding[];
}

export function DataReview({ buildings }: DataReviewProps) {
  const clients = [...new Set(buildings.map((b) => b.client_name).filter(Boolean))];
  const regions = [...new Set(buildings.map((b) => b.market_region).filter(Boolean))];
  const inspectors = [...new Set(buildings.map((b) => b.inspector_name).filter(Boolean))];
  const withWarnings = buildings.filter((b) => b._warnings.length > 0);
  const priorityCount = buildings.filter((b) => b.is_priority).length;
  const advanceNotice = buildings.filter((b) => b.requires_advance_notice).length;
  const escortRequired = buildings.filter((b) => b.requires_escort).length;
  const withEquipment = buildings.filter((b) => b.special_equipment.length > 0).length;

  const stats = [
    { label: "Buildings", value: buildings.length, icon: Building2, color: "text-primary" },
    { label: "Regions", value: regions.length, icon: MapPin, color: "text-info" },
    { label: "Inspectors", value: inspectors.length, icon: Users, color: "text-success" },
    { label: "Issues", value: withWarnings.length, icon: AlertTriangle, color: withWarnings.length > 0 ? "text-destructive" : "text-success" },
  ];

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${s.color}`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detected entities */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Detected Entities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Clients</p>
            <div className="flex flex-wrap gap-2">
              {clients.length > 0 ? clients.map((c) => (
                <Badge key={c} variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  {c}
                </Badge>
              )) : <span className="text-sm text-muted-foreground">None detected</span>}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Regions</p>
            <div className="flex flex-wrap gap-2">
              {regions.map((r) => (
                <Badge key={r} variant="outline" className="bg-info/10 text-info border-info/30">
                  {r}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Inspectors</p>
            <div className="flex flex-wrap gap-2">
              {inspectors.length > 0 ? inspectors.map((i) => (
                <Badge key={i} variant="outline" className="bg-success/10 text-success border-success/30">
                  {i}
                </Badge>
              )) : <span className="text-sm text-muted-foreground">None detected</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Flags */}
      {(priorityCount > 0 || advanceNotice > 0 || escortRequired > 0 || withEquipment > 0) && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Smart Flags Detected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {priorityCount > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <Clock className="h-4 w-4 text-warning" />
                  <div>
                    <p className="text-sm font-medium">{priorityCount} Priority</p>
                  </div>
                </div>
              )}
              {advanceNotice > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <Clock className="h-4 w-4 text-warning" />
                  <div>
                    <p className="text-sm font-medium">{advanceNotice} Advance Notice</p>
                  </div>
                </div>
              )}
              {escortRequired > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <Shield className="h-4 w-4 text-destructive" />
                  <div>
                    <p className="text-sm font-medium">{escortRequired} Escort Required</p>
                  </div>
                </div>
              )}
              {withEquipment > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-info/10 border border-info/20">
                  <Wrench className="h-4 w-4 text-info" />
                  <div>
                    <p className="text-sm font-medium">{withEquipment} Special Equipment</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warnings */}
      {withWarnings.length > 0 && (
        <Card className="bg-card border-border border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Rows with Issues ({withWarnings.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {withWarnings.slice(0, 20).map((b, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm">
                  <span className="font-medium">{b.property_name || b.address || `Row ${i + 1}`}</span>
                  <div className="flex gap-1">
                    {b._warnings.map((w) => (
                      <Badge key={w} variant="outline" className="text-[10px] text-destructive border-destructive/30">
                        {w}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
              {withWarnings.length > 20 && (
                <p className="text-xs text-muted-foreground text-center">
                  ...and {withWarnings.length - 20} more
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
