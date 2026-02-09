import { SYSTEM_FIELDS } from "@/lib/spreadsheet-parser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Columns, Eye } from "lucide-react";

interface ColumnMapperProps {
  headers: string[];
  mapping: Record<string, string>;
  onMappingChange: (fieldKey: string, header: string) => void;
  previewRows: Record<string, string>[];
}

export function ColumnMapper({ headers, mapping, onMappingChange, previewRows }: ColumnMapperProps) {
  // Headers already used in a mapping
  const usedHeaders = new Set(Object.values(mapping));

  // Get preview value for a system field
  const getPreview = (fieldKey: string, rowIdx: number) => {
    const header = mapping[fieldKey];
    if (!header || !previewRows[rowIdx]) return "—";
    const val = previewRows[rowIdx][header];
    return val ? String(val).substring(0, 60) : "—";
  };

  return (
    <div className="space-y-6">
      {/* Mapping Cards */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Columns className="h-4 w-4 text-primary" />
            Map Columns
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Match your spreadsheet columns to our system fields. Auto-matched where possible.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {SYSTEM_FIELDS.map((field) => (
              <div
                key={field.key}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{field.label}</span>
                    {field.required && (
                      <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                        Required
                      </Badge>
                    )}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="w-64 flex-shrink-0">
                  <Select
                    value={mapping[field.key] ?? "__none__"}
                    onValueChange={(val) =>
                      onMappingChange(field.key, val === "__none__" ? "" : val)
                    }
                  >
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Select column…" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border z-50">
                      <SelectItem value="__none__">— Not mapped —</SelectItem>
                      {headers.map((h) => (
                        <SelectItem
                          key={h}
                          value={h}
                          disabled={usedHeaders.has(h) && mapping[field.key] !== h}
                        >
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Preview Table */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            Data Preview (first 5 rows)
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                {SYSTEM_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                  <TableHead key={f.key} className="text-xs whitespace-nowrap">
                    {f.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.slice(0, 5).map((_, i) => (
                <TableRow key={i} className="border-border">
                  {SYSTEM_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                    <TableCell key={f.key} className="text-xs max-w-[200px] truncate">
                      {getPreview(f.key, i)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
