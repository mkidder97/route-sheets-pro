import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Menu } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-auto">
          {/* Mobile top bar */}
          <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background px-4 h-12 lg:hidden">
            <SidebarTrigger className="text-foreground" />
            <span className="text-sm font-bold text-foreground">RoofRoute</span>
          </header>
          <main className="flex-1 overflow-auto">
            <div className="p-4 lg:p-8">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
