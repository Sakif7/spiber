"use client";

import {
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  MoreHorizontal,
  Pencil,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Icons are referenced by KEY, not by component: list pages are Server
 * Components and cannot pass component functions across the client boundary.
 */
export type RowActionIcon =
  | "view"
  | "edit"
  | "invoice"
  | "delete"
  | "download"
  | "open"
  | "duplicate";

const ICONS: Record<RowActionIcon, LucideIcon> = {
  view: Eye,
  edit: Pencil,
  invoice: FileText,
  delete: Trash2,
  download: Download,
  open: ExternalLink,
  duplicate: Copy,
};

export type RowAction = {
  label: string;
  /** Navigate (internal route). Server pages can only use href actions. */
  href?: string;
  /** Run a handler — only available when the parent is a Client Component. */
  onSelect?: () => void;
  icon?: RowActionIcon;
  danger?: boolean;
  /** Draw a separator above this action. */
  separatorBefore?: boolean;
  disabled?: boolean;
};

/**
 * The"⋯" per-row menu for list tables: keeps rows quiet (one icon button)
 * while still exposing View / Edit / Delete and any entity-specific action.
 */
export function RowActions({
  actions,
  label = "Row actions",
}: {
  actions: RowAction[];
  label?: string;
}) {
  if (actions.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          className="text-muted-foreground hover:text-foreground"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {actions.map((a, i) => {
          const Icon = a.icon ? ICONS[a.icon] : null;
          const content = (
            <>
              {Icon && <Icon className="size-4" />}
              {a.label}
            </>
          );
          return (
            <span key={`${a.label}-${i}`} className="contents">
              {a.separatorBefore && <DropdownMenuSeparator />}
              {a.href ? (
                <DropdownMenuItem
                  asChild
                  variant={a.danger ? "destructive" : "default"}
                  disabled={a.disabled}
                >
                  <Link href={a.href}>{content}</Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  variant={a.danger ? "destructive" : "default"}
                  disabled={a.disabled}
                  onSelect={() => a.onSelect?.()}
                >
                  {content}
                </DropdownMenuItem>
              )}
            </span>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
