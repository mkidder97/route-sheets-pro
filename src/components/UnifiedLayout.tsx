import { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Building2,
  Menu,
  LogOut,
  LayoutDashboard,
  Briefcase,
  ClipboardCheck,
  Wrench,
  Shield,
  ChevronDown,
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

        {/* Dropdown sections */}
        {NAV_SECTIONS.map((section) => (
          <NavigationMenuItem key={section.label}>
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
      <DrawerContent className="h-full w-[280px] rounded-none border-r fixed left-0 top-0 bottom-0">
        <div className="flex flex-col h-full overflow-y-auto p-4 pt-6">
          {/* Dashboard */}
          <button
            onClick={() => go("/dashboard")}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === "/dashboard" ? "bg-accent/30 text-primary" : "hover:bg-accent/50"
            )}
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </button>

          {/* Sections */}
          {NAV_SECTIONS.map((section) => (
            <Collapsible key={section.label} defaultOpen={isSectionActive(pathname, section.prefix)}>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium mt-2 hover:bg-accent/50 transition-colors">
                <span className="flex items-center gap-2">
                  <section.icon className="h-4 w-4" />
                  {section.label}
                </span>
                <ChevronDown className="h-3 w-3 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-6 flex flex-col gap-0.5 mt-0.5">
                  {section.items.map((item) => (
                    <button
                      key={item.to}
                      onClick={() => go(item.to)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm text-left transition-colors",
                        pathname === item.to ? "bg-accent/30 text-primary font-medium" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
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
      <header className="sticky top-0 z-50 flex h-14 items-center gap-2 border-b border-border bg-background px-4 lg:px-6">
        {/* Mobile hamburger */}
        {isMobile && <MobileNav />}

        {/* Brand */}
        <Link to="/dashboard" className="flex items-center gap-2 mr-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/20">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-bold text-foreground">RoofMind</span>
        </Link>

        {/* Desktop nav */}
        <DesktopNav />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side */}
        <div className="flex items-center gap-2">
          <NotificationBell />
          {profile?.full_name && (
            <span className="hidden md:inline text-sm text-muted-foreground">{profile.full_name}</span>
          )}
          <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
