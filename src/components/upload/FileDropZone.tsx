import { useCallback, useState } from "react";
import { Upload as UploadIcon, CheckCircle } from "lucide-react";

interface FileDropZoneProps {
  onFile: (file: File) => void;
  file: File | null;
  loading: boolean;
}

export function FileDropZone({ onFile, file, loading }: FileDropZoneProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files?.[0]) onFile(e.dataTransfer.files[0]);
    },
    [onFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) onFile(e.target.files[0]);
    },
    [onFile]
  );

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => !loading && document.getElementById("file-input")?.click()}
      className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-all cursor-pointer ${
        dragActive
          ? "border-primary bg-primary/5"
          : file
          ? "border-success/50 bg-success/5"
          : "border-border hover:border-muted-foreground/50 hover:bg-muted/30"
      } ${loading ? "pointer-events-none opacity-60" : ""}`}
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
            {(file.size / 1024).toFixed(1)} KB
          </p>
        </>
      ) : (
        <>
          <div className="p-4 rounded-full bg-muted mb-4">
            <UploadIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium">Drop your spreadsheet here</p>
          <p className="text-sm text-muted-foreground mt-1">
            Supports .xlsx, .xls, .csv
          </p>
        </>
      )}
    </div>
  );
}
