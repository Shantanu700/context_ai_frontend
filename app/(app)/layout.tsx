import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    // One provider for the whole shell: the editor's controls are icon-only, and the
    // collapsed sidebar labels its rail the same way. 250ms is long enough that a
    // cursor crossing the toolbar doesn't leave a trail of popups.
    <TooltipProvider delay={250}>
      {/* Wider collapsed rail: icons sit above their labels, so 3rem is too tight. */}
      <SidebarProvider style={{ "--sidebar-width-icon": "5rem" } as React.CSSProperties}>
        <AppSidebar />
        {/* Laptop: the shell is exactly the viewport, so panels scroll inside
            themselves. Narrow: it grows and the page scrolls instead. */}
        <SidebarInset className="flex flex-col gap-2 p-2 lg:h-svh lg:overflow-hidden">
          <header className="panel flex items-center gap-3 px-3 py-2">
            <SidebarTrigger />
            <span className="text-sm font-medium">Context</span>
            {/* Page-level actions belong to the page — the editor has its own bar. */}
          </header>
          {/* Gaps of ground are the dividers — no borders between regions. */}
          <div className="flex min-h-0 min-w-0 flex-1 gap-2">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
