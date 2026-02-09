import { useCallback, useState } from "react";
import { Upload as UploadIcon, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function UploadPage() {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Upload Spreadsheet</h1>
        <p className="text-muted-foreground mt-1">
          Import building inspection data from Excel or CSV files
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-8">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-all cursor-pointer ${
              dragActive
                ? "border-primary bg-primary/5"
                : file
                ? "border-success/50 bg-success/5"
                : "border-border hover:border-muted-foreground/50 hover:bg-muted/30"
            }`}
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />

            {file ? (
              <>
                <CheckCircle className="h-12 w-12 text-success mb-4" />
                <p className="text-lg font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {(file.size / 1024).toFixed(1)} KB • Ready to parse
                </p>
                <Button className="mt-6" disabled>
                  Parse & Import (Coming in Phase 2)
                </Button>
              </>
            ) : (
              <>
                <div className="p-4 rounded-full bg-muted mb-4">
                  <UploadIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium">Drop your spreadsheet here</p>
                <p className="text-sm text-muted-foreground mt-1">
                  or click to browse — supports .xlsx, .xls, .csv
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Expected format */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            Expected Columns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {[
              "Client", "Market / Region", "Roof Group", "Building Code",
              "Stop Number", "Property Name", "Address", "City",
              "State", "Zip Code", "Inspection Date", "Inspector",
              "Square Footage", "Roof Access", "Access Location",
            ].map((col) => (
              <div key={col} className="flex items-center gap-2 text-sm py-1.5 px-3 rounded-md bg-muted/50">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                {col}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <AlertCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              Column names don't need to match exactly — the parser will auto-detect and let you
              map columns after upload.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
