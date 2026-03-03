import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Home, Building2, ClipboardCheck, User, LogOut, Monitor } from "lucide-react";
import emblem from "@/assets/roofmind-emblem.png";

const NAV_ITEMS = [
  { icon: Home, label: "Home", path: "/field" },
  { icon: Building2, label: "CM Jobs", path: "/field/cm" },
  { icon: ClipboardCheck, label: "Inspections", path: "/field/inspections" },
  { icon: User, label: "Profile", path: "/field/profile" },
] as const;

export default function FieldLayout() {
  const { profile, signOut } = useAuth();
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) =>
    path === "/field"
      ? location.pathname === "/field"
      : location.pathname.startsWith(path);

  return (
    <div className="flex h-screen flex-col bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-slate-700/50 px-4">
        <div className="flex items-center gap-2">
          <img src={emblem} alt="RoofMind" className="h-6 w-6" />
          <span className="text-sm font-bold text-slate-100">RoofMind</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition-colors"
            aria-label="Office mode"
          >
            <Monitor className="h-4 w-4" />
            <span className="hidden sm:inline text-xs font-medium">Office</span>
          </button>
          <span className="text-xs text-slate-400">{profile?.full_name}</span>
          <button
            onClick={() => signOut()}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        {!isMobile && (
          <nav className="flex w-16 shrink-0 flex-col items-center gap-2 border-r border-slate-700/30 bg-slate-900 py-4">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.path);
              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => navigate(item.path)}
                      className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                        active
                          ? "bg-blue-600/20 text-blue-400"
                          : "text-slate-500 hover:bg-slate-700/30 hover:text-slate-300"
                      }`}
                      aria-label={item.label}
                    >
                      <item.icon className="h-5 w-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-slate-800 text-slate-100 border-slate-700">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>
        )}

        {/* Content area */}
        <main className="flex-1 overflow-y-auto p-4">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      {isMobile && (
        <nav className="flex h-14 shrink-0 items-center justify-around border-t border-slate-700/50 bg-slate-900">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex min-w-[56px] flex-col items-center gap-0.5 py-1 ${
                  active ? "text-blue-400" : "text-slate-500"
                }`}
                aria-label={item.label}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
