"use client";

import { useState } from "react";
import { useRouter, Link } from "@/i18n/navigation";
import { LogOut, ExternalLink, ShieldCheck, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function AdminUserMenu({
  email,
  role,
}: {
  email: string;
  role?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const initial = (email || "?").charAt(0).toUpperCase();
  const roleLabel = role === "super_admin" ? "Super admin" : "Admin";

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="hover:bg-muted focus-visible:ring-ring/50 flex items-center gap-2 rounded-full border border-transparent py-1 pr-1 pl-1 transition-colors outline-none focus-visible:ring-[3px] sm:pr-2.5"
          aria-label="Account menu"
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/12 text-primary text-xs font-semibold">
              {initial}
            </AvatarFallback>
          </Avatar>
          <span className="text-muted-foreground hidden max-w-[180px] truncate text-sm sm:inline">
            {email}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-1 py-2">
          <span className="text-foreground truncate text-sm font-medium">
            {email}
          </span>
          <span className="bg-primary/10 text-primary inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium">
            <ShieldCheck className="size-3" />
            {roleLabel}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/" target="_blank">
            <ExternalLink className="size-4" />
            View live site
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={(e) => {
            e.preventDefault();
            void signOut();
          }}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LogOut className="size-4" />
          )}
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
