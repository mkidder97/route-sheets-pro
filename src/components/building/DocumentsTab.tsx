import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Image,
  FileSpreadsheet,
  File,
  Upload,
  Trash2,
  Download,
  Loader2,
} from "lucide-react";

interface DocumentsTabProps {
  buildingId: string;
  canWrite: boolean;
}

interface DocRow {
  id: string;
  building_id: string;
  uploaded_by: string | null;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  category: string | null;
  created_at: string | null;
}

const CATEGORIES = ["other", "warranty", "report", "drawing", "photo", "contract"] as const;

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext))
    return <Image className="h-5 w-5 text-blue-400 shrink-0" />;
  if (["xlsx", "xls", "csv"].includes(ext))
    return <FileSpreadsheet className="h-5 w-5 text-emerald-400 shrink-0" />;
  if (ext === "pdf")
    return <File className="h-5 w-5 text-red-400 shrink-0" />;
  return <FileText className="h-5 w-5 text-slate-400 shrink-0" />;
}

function formatSize(bytes: number | null) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export default function DocumentsTab({ buildingId, canWrite }: DocumentsTabProps) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchDocs = useCallback(async () => {
    const { data } = await supabase
      .from("building_documents")
      .select("*")
      .eq("building_id", buildingId)
      .order("created_at", { ascending: false });
    if (data) setDocs(data as DocRow[]);
    setLoading(false);
  }, [buildingId]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        const storagePath = `${buildingId}/documents/${Date.now()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage
          .from("building-files")
          .upload(storagePath, file);
        if (uploadErr) throw uploadErr;

        const { error: insertErr } = await supabase
          .from("building_documents")
          .insert({
            building_id: buildingId,
            uploaded_by: user?.id ?? null,
            file_name: file.name,
            file_path: storagePath,
            file_size: file.size,
            file_type: file.type || null,
            category: "other",
          });
        if (insertErr) throw insertErr;
      }
      toast.success(`${files.length} file${files.length > 1 ? "s" : ""} uploaded`);
      fetchDocs();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDownload = async (doc: DocRow) => {
    const { data, error } = await supabase.storage
      .from("building-files")
      .createSignedUrl(doc.file_path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Failed to generate download link");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async (doc: DocRow) => {
    const { error: storageErr } = await supabase.storage
      .from("building-files")
      .remove([doc.file_path]);
    if (storageErr) {
      toast.error("Failed to delete file from storage");
      return;
    }
    const { error: dbErr } = await supabase
      .from("building_documents")
      .delete()
      .eq("id", doc.id);
    if (dbErr) {
      toast.error("Failed to delete record");
      return;
    }
    toast.success("Document deleted");
    fetchDocs();
  };

  const handleCategoryChange = async (docId: string, category: string) => {
    const { error } = await supabase
      .from("building_documents")
      .update({ category })
      .eq("id", docId);
    if (error) {
      toast.error("Failed to update category");
    } else {
      setDocs((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, category } : d))
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-slate-800 border border-slate-700/50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-slate-100">Documents</h3>
        {canWrite && (
          <>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="*/*"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              Upload Document
            </Button>
          </>
        )}
      </div>

      {/* List */}
      {docs.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-20 text-slate-400" />
          <p className="text-sm font-medium text-slate-300">No documents uploaded yet</p>
          <p className="text-xs text-slate-500 mt-1">
            Upload files like inspection reports, warranties, CAD drawings, and photos.
          </p>
        </div>
      ) : (
        <div>
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 py-3 border-b border-slate-700/50 last:border-0"
            >
              {getFileIcon(doc.file_name)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-100 truncate">
                  {truncate(doc.file_name, 40)}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-500">
                    {formatSize(doc.file_size)}
                  </span>
                  {doc.created_at && (
                    <span className="text-xs text-slate-500">
                      · {format(parseISO(doc.created_at), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
              </div>

              {/* Category */}
              {canWrite ? (
                <Select
                  value={doc.category ?? "other"}
                  onValueChange={(v) => handleCategoryChange(doc.id, v)}
                >
                  <SelectTrigger className="w-28 h-7 text-xs bg-slate-900 border-slate-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="text-xs capitalize">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge
                  variant="secondary"
                  className="text-xs bg-slate-700/50 text-slate-300"
                >
                  {doc.category ?? "other"}
                </Badge>
              )}

              {/* Actions */}
              <Button variant="ghost" size="sm" onClick={() => handleDownload(doc)}>
                <Download className="h-4 w-4" />
              </Button>
              {canWrite && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(doc)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
