"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronsUpDownIcon, LogOutIcon } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { loginDestroy, loginRetrieve, type User } from "@/lib/api";

export function NavUser() {
  const router = useRouter();
  const { isMobile } = useSidebar();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Doubles as the auth guard. Next middleware can't do this job: the
    // `sessionid` cookie belongs to the API's origin, so the app's own server
    // never sees it. Asking the API who we are is the only reliable check.
    loginRetrieve().then(({ data, response }) => {
      if (cancelled) return;
      if (data && response?.ok) setUser(data);
      // Only a real "you are not signed in" answer bounces. A missing response
      // means the API is unreachable, which is not the same thing — throwing
      // someone back to the login form over a network blip loses their place.
      else if (response && (response.status === 401 || response.status === 403))
        router.replace("/login");
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function logOut() {
    await loginDestroy();
    router.replace("/login");
  }

  const initials = user?.username.slice(0, 2).toUpperCase() ?? "";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={user ? `Account: ${user.username}` : "Account"}
            render={
              <SidebarMenuButton
                size="lg"
                className="gap-3 group-data-[collapsible=icon]:w-full! group-data-[collapsible=icon]:justify-center"
              />
            }
          >
            <Avatar size="sm">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm font-medium">
                {user?.username ?? "…"}
              </span>
              {user?.email && (
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              )}
            </span>
            <ChevronsUpDownIcon className="ml-auto group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={8}
          >
            {/* Base UI's GroupLabel reads MenuGroupContext — throws outside a Group. */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <span className="block truncate text-sm font-medium">
                  {user?.username ?? "…"}
                </span>
                {user?.email && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                )}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logOut}>
              <LogOutIcon />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
