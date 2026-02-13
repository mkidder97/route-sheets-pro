import { LayoutDashboard, Kanban, Calendar, Clock, Settings, ArrowLeft, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const opsNav = [
  { title: "Dashboard", url: "/ops", icon: LayoutDashboard },
  { title: "Job Board", url: "/ops/jobs", icon: Kanban },
  { title: "Scheduling", url: "/ops/scheduling", icon: Calendar },
  { title: "Time & Mileage", url: "/ops/time-mileage", icon: Clock },
  { title: "Settings", url: "/ops/settings", icon: Settings },
];

const roleLabels: Record<string, string> = {
  admin: "Admin",
  office_manager: "Office Manager",
  field_ops: "Field Ops",
  engineer: "Engineer",
};

export function OpsSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { profile, role, signOut } = useAuth();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <div className="flex h-14 items-center gap-2 px-4 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary">
          <Kanban className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-bold text-sidebar-accent-foreground">RoofOps</span>
            <span className="text-[10px] text-sidebar-foreground">Operations Hub</span>
          </div>
        )}
      </div>

      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {opsNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/ops"}
                      className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <div className="mt-auto border-t border-sidebar-border p-2 space-y-1">
        {/* User info */}
        {profile && !collapsed && (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-sidebar-accent-foreground">
                {profile.full_name || profile.email}
              </p>
              {role && (
                <p className="truncate text-[10px] text-sidebar-foreground/70">
                  {roleLabels[role] ?? role}
                </p>
              )}
            </div>
            <button
              onClick={signOut}
              className="shrink-0 rounded-md p-1 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {profile && collapsed && (
          <button
            onClick={signOut}
            className="flex w-full items-center justify-center rounded-md p-1.5 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}

        {!collapsed && (
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-sidebar-foreground hover:text-sidebar-accent-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Switch to RoofRoute
          </Link>
        )}
        <SidebarTrigger className="w-full justify-center text-sidebar-foreground hover:text-sidebar-accent-foreground" />
      </div>
    </Sidebar>
  );
}
