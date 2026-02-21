import { Building2, Database, Route, Settings as SettingsIcon, ArrowRight, LogOut } from "lucide-react";
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

const mainNav = [
  { title: "My Routes", url: "/", icon: Route },
  { title: "Route Builder", url: "/route-builder", icon: Route },
  { title: "Buildings", url: "/buildings", icon: Database },
  { title: "Settings", url: "/settings", icon: SettingsIcon },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut, profile } = useAuth();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <div className="flex h-14 items-center gap-2 px-4 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
          <Building2 className="h-4 w-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-bold text-sidebar-accent-foreground">RoofRoute</span>
            <span className="text-[10px] text-sidebar-foreground">Inspection Manager</span>
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
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
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
        {!collapsed && profile && (
          <div className="px-3 py-1.5 text-xs text-sidebar-foreground truncate">
            {profile.full_name}
          </div>
        )}
        {!collapsed && (
          <Link
            to="/ops"
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-sidebar-foreground hover:text-sidebar-accent-foreground transition-colors"
          >
            Switch to RoofOps
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
        {!collapsed && (
          <button
            onClick={() => signOut()}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-sidebar-foreground hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut className="h-3 w-3" />
            Sign Out
          </button>
        )}
        <SidebarTrigger className="w-full justify-center text-sidebar-foreground hover:text-sidebar-accent-foreground" />
      </div>
    </Sidebar>
  );
}
