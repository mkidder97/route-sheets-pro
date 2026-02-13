import { LayoutDashboard, Kanban, Calendar, Clock, Settings, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
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

export function OpsSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

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
