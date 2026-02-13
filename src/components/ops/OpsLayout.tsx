import { Outlet, NavLink } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { OpsSidebar } from "@/components/ops/OpsSidebar";
import { NotificationBell } from "@/components/ops/NotificationBell";
import { useIsMobile } from "@/hooks/use-mobile";
import { LayoutDashboard, Kanban, Calendar, Clock } from "lucide-react";

const mobileTabs = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/ops", end: true },
  { label: "Jobs", icon: Kanban, to: "/ops/jobs", end: false },
  { label: "Scheduling", icon: Calendar, to: "/ops/scheduling", end: false },
  { label: "Time", icon: Clock, to: "/ops/time-mileage", end: false },
];

export default function OpsLayout() {
  const isMobile = useIsMobile();

  return (
    <div className="ops-theme">
      <SidebarProvider defaultOpen={!isMobile}>
        <div className="flex min-h-screen w-full">
          <OpsSidebar />
          <div className="flex-1 flex flex-col overflow-auto">
            {/* Desktop top bar */}
            <header className="sticky top-0 z-20 hidden lg:flex items-center justify-end border-b border-border bg-background px-6 h-12">
              <NotificationBell />
            </header>

            {/* Mobile top bar */}
            <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background px-4 h-12 lg:hidden">
              <SidebarTrigger className="text-foreground" />
              <span className="text-sm font-bold text-foreground">RoofOps</span>
              <div className="ml-auto">
                <NotificationBell />
              </div>
            </header>

            <main className="flex-1 overflow-auto pb-16 lg:pb-0">
              <div className="p-4 lg:p-8">
                <Outlet />
              </div>
            </main>

            {/* Mobile bottom tab bar */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border bg-background h-14 lg:hidden">
              {mobileTabs.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] transition-colors ${
                      isActive
                        ? "text-sidebar-primary font-medium"
                        : "text-muted-foreground"
                    }`
                  }
                >
                  <tab.icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </SidebarProvider>
    </div>
  );
}
