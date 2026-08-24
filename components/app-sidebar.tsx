"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BoxesIcon, ClapperboardIcon, CloudUploadIcon, GemIcon } from "lucide-react";

import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const NAV = [
  { label: "Projects", href: "/projects", icon: BoxesIcon },
  { label: "Upload", href: "/upload", icon: CloudUploadIcon },
  { label: "Ad library", href: "/ads", icon: GemIcon },
  { label: "Editor", href: "/editor", icon: ClapperboardIcon },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" className="group-data-[side=left]:border-r-0" {...props}>
      <SidebarHeader className="group-data-[collapsible=icon]:pt-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/projects" />}
              // size=lg keeps h-14 but the collapsed w-8 sticks, so the mark
              // ends up squeezed and left of centre. Take the full rail width.
              className="gap-3 group-data-[collapsible=icon]:w-full! group-data-[collapsible=icon]:justify-center"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-linear-to-b from-signal to-synth text-sm font-semibold text-signal-foreground">
                C
              </span>
              <span className="truncate font-semibold group-data-[collapsible=icon]:hidden">
                Context
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {NAV.map(({ label, href, icon: Icon }) => (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton
                  isActive={pathname === href}
                  render={<Link href={href} />}
                  // Selection reads as signal, not the default neutral accent.
                  // Collapsed: icon stacked over its label, so no tooltip is needed.
                  className="gap-3 data-active:bg-signal/12 data-active:text-signal group-data-[collapsible=icon]:size-auto! group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1.5 group-data-[collapsible=icon]:px-1! group-data-[collapsible=icon]:py-2.5! group-data-[collapsible=icon]:[&_svg]:size-5 group-data-[collapsible=icon]:[&>span]:text-[10px] group-data-[collapsible=icon]:[&>span]:leading-none group-data-[collapsible=icon]:hover:bg-transparent! group-data-[collapsible=icon]:active:bg-transparent! group-data-[collapsible=icon]:data-active:bg-transparent!"
                >
                  <Icon />
                  <span>{label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="group-data-[collapsible=icon]:pb-4">
        <NavUser />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
