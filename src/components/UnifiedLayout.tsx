import { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import roofmindEmblem from "@/assets/roofmind-emblem.png";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { NotificationBell } from "@/components/ops/NotificationBell";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Building2,
  Menu,
  LogOut,
  LayoutDashboard,
  BarChart3,
  Briefcase,
  ClipboardCheck,
  Wrench,
  Shield,
} from "lucide-react";

const NAV_SECTIONS = [
  {
    label: "Portfolio",
    icon: Briefcase,
    prefix: ["/buildings", "/clients", "/contacts", "/contractors", "/warranties", "/budgets"],
    items: [
      { label: "Buildings", to: "/buildings" },
      { label: "Clients", to: "/clients" },
      { label: "Contacts", to: "/contacts" },
      { label: "Contractors", to: "/contractors" },
      { label: "Warranties", to: "/warranties" },
      { label: "Budgets", to: "/budgets" },
    ],
  },
  {
    label: "Inspections",
    icon: ClipboardCheck,
    prefix: ["/inspections", "/route-builder", "/my-routes"],
    items: [
      { label: "My Routes", to: "/my-routes" },
      { label: "Campaigns", to: "/inspections/campaigns" },
      { label: "Route Plans", to: "/route-builder" },
      { label: "Schedule", to: "/inspections/schedule" },
      { label: "History", to: "/inspections/history" },
    ],
  },
  {
    label: "Operations",
    icon: Wrench,
    prefix: ["/ops"],
    items: [
      { label: "CM Jobs", to: "/ops/jobs" },
      { label: "Work Orders", to: "/ops/work-orders" },
      { label: "Mileage", to: "/ops/time-mileage" },
      { label: "PTO", to: "/ops/scheduling" },
    ],
  },
  {
    label: "Admin",
    icon: Shield,
    prefix: ["/admin", "/settings"],
    items: [
      { label: "Users", to: "/admin/users" },
      { label: "Regions", to: "/admin/regions" },
      { label: "Data Import", to: "/admin/data" },
      { label: "Settings", to: "/settings" },
    ],
  },
];

function isSectionActive(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname.startsWith(p));
}

/* ─── Desktop Navigation Menu Item (dropdown link) ─── */
function NavDropdownLink({ to, label, pathname }: { to: string; label: string; pathname: string }) {
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link
          to={to}
          className={cn(
            "block select-none rounded-md px-3 py-2 text-sm leading-none no-underline outline-none transition-colors",
            "hover:bg-accent/50 hover:text-accent-foreground focus:bg-accent/50",
            pathname === to && "bg-accent/30 text-primary font-medium"
          )}
        >
          {label}
        </Link>
      </NavigationMenuLink>
    </li>
  );
}

/* ─── Desktop Top Nav ─── */
function DesktopNav() {
  const { pathname } = useLocation();

  return (
    <NavigationMenu className="hidden lg:flex">
      <NavigationMenuList>
        {/* Dashboard — plain link */}
        <NavigationMenuItem>
          <Link to="/dashboard" className={cn(navigationMenuTriggerStyle(), pathname === "/dashboard" && "text-primary")}>
            Dashboard
          </Link>
        </NavigationMenuItem>

        {/* Analytics — plain link */}
        <NavigationMenuItem>
          <Link to="/analytics" className={cn(navigationMenuTriggerStyle(), pathname === "/analytics" && "text-primary")}>
            Analytics
          </Link>
        </NavigationMenuItem>

        {/* Dropdown sections */}
        {NAV_SECTIONS.map((section) => (
          <NavigationMenuItem key={section.label} className="relative">
            <NavigationMenuTrigger
              className={cn(isSectionActive(pathname, section.prefix) && "text-primary")}
            >
              {section.label}
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid w-48 gap-1 p-2">
                {section.items.map((item) => (
                  <NavDropdownLink key={item.to} to={item.to} label={item.label} pathname={pathname} />
                ))}
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  );
}

/* ─── Mobile Drawer Nav ─── */
function MobileNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const go = (to: string) => {
    navigate(to);
    setOpen(false);
  };

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="left">
      <DrawerTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-full w-56 rounded-none bg-slate-900 border-r border-slate-700/30 fixed left-0 top-0 bottom-0">
        <div className="flex flex-col h-full overflow-y-auto py-4">
          {/* Dashboard */}
          <button
            onClick={() => go("/dashboard")}
            className={cn(
              "flex items-center gap-2.5 rounded-md mx-2 px-3 py-1.5 text-sm font-medium transition-colors",
              pathname === "/dashboard"
                ? "bg-slate-700/60 text-white"
                : "text-slate-400 hover:bg-slate-700/30 hover:text-slate-200"
            )}
          >
            <LayoutDashboard className={cn("w-4 h-4", pathname === "/dashboard" ? "text-white" : "text-slate-400")} />
            Dashboard
          </button>

          {/* Analytics */}
          <button
            onClick={() => go("/analytics")}
            className={cn(
              "flex items-center gap-2.5 rounded-md mx-2 px-3 py-1.5 text-sm font-medium transition-colors",
              pathname === "/analytics"
                ? "bg-slate-700/60 text-white"
                : "text-slate-400 hover:bg-slate-700/30 hover:text-slate-200"
            )}
          >
            <BarChart3 className={cn("w-4 h-4", pathname === "/analytics" ? "text-white" : "text-slate-400")} />
            Analytics
          </button>

          {/* Sections — show items directly under section label */}
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mt-5 mb-1.5 px-5">
                {section.label}
              </p>
              <div className="flex flex-col gap-0.5 mx-2">
                {section.items.map((item) => {
                  const isActive = pathname === item.to;
                  return (
                    <button
                      key={item.to}
                      onClick={() => go(item.to)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-left transition-colors font-medium",
                        isActive
                          ? "bg-slate-700/60 text-white"
                          : "text-slate-400 hover:bg-slate-700/30 hover:text-slate-200"
                      )}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/* ─── Unified Layout ─── */
export default function UnifiedLayout() {
  const { profile, signOut } = useAuth();
  const isMobile = useIsMobile();

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top Nav Bar */}
      <header className="sticky top-0 z-50 flex h-11 items-center gap-2 border-b border-slate-700/50 bg-slate-900/95 backdrop-blur-sm px-4 lg:px-6">
        {/* Mobile hamburger */}
        {isMobile && <MobileNav />}

        {/* Brand */}
        <Link to="/dashboard" className="flex items-center gap-2 mr-4">
          <img src={roofmindEmblem} alt="RoofMind" className="h-6 w-6 rounded object-cover" />
          <span className="text-sm font-semibold text-white tracking-tight">RoofMind</span>
        </Link>

        {/* Desktop nav */}
        <DesktopNav />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side */}
        <div className="flex items-center gap-1.5">
          <NotificationBell />
          {profile?.full_name && (
            <span className="hidden md:inline text-xs text-muted-foreground px-2">{profile.full_name}</span>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={signOut} title="Sign out">
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
