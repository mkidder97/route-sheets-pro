import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";

export default function FieldProfile() {
  const { profile, role, signOut } = useAuth();

  return (
    <div className="mx-auto max-w-sm space-y-6 py-8">
      <div className="flex flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-700">
          <User className="h-8 w-8 text-slate-400" />
        </div>
        <h1 className="mt-4 text-lg font-bold text-slate-100">{profile?.full_name}</h1>
        <p className="text-sm text-slate-400">{profile?.email}</p>
        {role && (
          <Badge variant="outline" className="mt-2 border-blue-500/30 text-blue-400 text-xs">
            {role.replace("_", " ")}
          </Badge>
        )}
      </div>

      <Button
        variant="outline"
        className="w-full border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
        onClick={() => signOut()}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Sign Out
      </Button>
    </div>
  );
}
