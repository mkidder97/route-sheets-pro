import { useAuth } from "@/hooks/useAuth";
import FieldTodayView from "@/components/FieldTodayView";
import { ClipboardCheck } from "lucide-react";

export default function FieldInspections() {
  const { profile } = useAuth();

  if (profile?.inspector_id) {
    return <FieldTodayView inspectorId={profile.inspector_id} />;
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 text-slate-500">
      <ClipboardCheck className="h-12 w-12 opacity-20" />
      <p className="mt-3 text-sm">No route assigned</p>
      <p className="mt-1 text-xs text-slate-600">Ask your office manager to link your inspector profile</p>
    </div>
  );
}
