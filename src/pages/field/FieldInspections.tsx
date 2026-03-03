import { Lock } from "lucide-react";

export default function FieldInspections() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-slate-500">
      <Lock className="h-12 w-12 opacity-20" />
      <p className="mt-3 text-sm font-medium">Inspections coming soon</p>
    </div>
  );
}
