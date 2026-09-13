"use client";

import {
  Archive,
  ArchiveX,
  ChevronsUpDown,
  File,
  Folder,
  FolderPlus,
  Inbox,
  MoreHorizontal,
  Pencil,
  Send,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/cn";
import type { MailFolder, SpecialUse } from "@/lib/mail/store/types";
import type { AccessibleMailbox } from "@/lib/services/mail.service";
import { initials } from "./mail-shared";

/**
 * The rail: whose mailbox is open, then its folders. Styled like the admin
 * sidebar (soft tinted active row, quiet counts) so the mail page reads as
 * part of the app rather than a widget dropped into it.
 */
const ICON: Record<NonNullable<SpecialUse>, typeof Inbox> = {
  inbox: Inbox,
  drafts: File,
  sent: Send,
  junk: ArchiveX,
  trash: Trash2,
  archive: Archive,
};
const ORDER: NonNullable<SpecialUse>[] = [
  "inbox",
  "drafts",
  "sent",
  "junk",
  "trash",
  "archive",
];

/** The virtual "Starred" view: every flagged message, across folders. */
export const STARRED = "__starred__";

export function splitFolders(folders: MailFolder[]) {
  const standard = ORDER.map((s) =>
    folders.find((f) => f.specialUse === s),
  ).filter((f): f is MailFolder => Boolean(f));
  const custom = folders.filter((f) => !f.specialUse);
  return { standard, custom };
}

export function countFor(f: MailFolder): number {
  return f.specialUse === "drafts" ? f.total : f.unseen;
}

function mailboxLine(m: AccessibleMailbox): string {
  return m.own
    ? "Your mailbox"
    : m.kind === "shared"
      ? "Shared mailbox"
      : "Opened as super admin";
}

/** Avatar + address + what it is to me — the switcher's face. */
function MailboxIdentity({ mailbox }: { mailbox: AccessibleMailbox }) {
  const [local, domain] = mailbox.address.split("@");
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          mailbox.kind === "shared"
            ? "bg-muted text-muted-foreground"
            : "bg-sidebar-accent text-sidebar-accent-foreground",
        )}
        aria-hidden
      >
        {mailbox.kind === "shared" ? (
          <Users className="size-4" />
        ) : (
          initials({ name: null, address: local })
        )}
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-foreground truncate text-sm font-medium">
          {local}
          <span className="text-muted-foreground font-normal">@{domain}</span>
        </span>
        <span className="text-muted-foreground truncate text-xs">
          {mailboxLine(mailbox)}
        </span>
      </span>
    </span>
  );
}

export function MailboxSwitcher({
  mailboxes,
  value,
  onChange,
}: {
  mailboxes: AccessibleMailbox[];
  value: string;
  onChange: (address: string) => void;
}) {
  const current = mailboxes.find((m) => m.address === value) ?? mailboxes[0];
  return (
    <div className="flex h-[52px] items-center px-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          aria-label="Mailbox"
          className="hover:bg-sidebar-accent/60 h-auto w-full justify-between gap-1 rounded-md border-0 bg-transparent px-1.5 py-1 shadow-none *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1 dark:bg-transparent [&>svg:last-child]:hidden"
        >
          <SelectValue>
            <MailboxIdentity mailbox={current} />
          </SelectValue>
          <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
        </SelectTrigger>
        <SelectContent
          align="start"
          className="w-[var(--radix-select-trigger-width)] min-w-56"
        >
          {mailboxes.map((m) => (
            <SelectItem key={m.address} value={m.address} className="py-1.5">
              <span className="flex flex-col leading-tight">
                <span className="text-sm">{m.address}</span>
                <span className="text-muted-foreground text-xs">
                  {mailboxLine(m)}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type Row = {
  key: string;
  label: string;
  icon: typeof Inbox;
  count: number;
  countLabel: string;
  loud: boolean;
  /** A folder the person created: rename / delete live on it. */
  custom: boolean;
};

function rowFor(f: MailFolder): Row {
  const count = countFor(f);
  return {
    key: f.path,
    label: f.name,
    icon: (f.specialUse && ICON[f.specialUse]) || Folder,
    count,
    countLabel:
      f.specialUse === "drafts" ? `${count} drafts` : `${count} unread`,
    loud: count > 0 && f.specialUse !== "drafts",
    custom: !f.specialUse,
  };
}

function NavRow({
  row,
  on,
  onSelect,
  onRename,
  onDelete,
}: {
  row: Row;
  on: boolean;
  onSelect: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}) {
  const Icon = row.icon;
  const actions = row.custom && onRename && onDelete;
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onSelect}
        aria-current={on ? "page" : undefined}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150",
          on
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
          actions && "pr-8",
        )}
      >
        <Icon
          size={16}
          strokeWidth={2}
          aria-hidden
          className={cn(
            "shrink-0 transition-colors",
            on
              ? "text-sidebar-primary"
              : "text-muted-foreground group-hover:text-foreground",
          )}
        />
        <span className="min-w-0 flex-1 truncate">{row.label}</span>
        {row.count > 0 && (
          <span
            className={cn(
              "shrink-0 text-xs tabular-nums",
              on
                ? "text-sidebar-accent-foreground"
                : row.loud
                  ? "text-foreground font-medium"
                  : "text-muted-foreground",
              actions && "group-focus-within:hidden group-hover:hidden",
            )}
            aria-label={row.countLabel}
          >
            {row.count > 999 ? "999+" : row.count}
          </span>
        )}
      </button>
      {actions && (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Options for ${row.label}`}
              className="text-muted-foreground absolute top-1/2 right-1 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreHorizontal className="size-3.5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={onRename}>
              <Pencil className="size-4" aria-hidden />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDelete} variant="destructive">
              <Trash2 className="size-4" aria-hidden />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

/**
 * The standard folders (with Starred after Inbox), then "Folders": the ones
 * this mailbox created, with a + to add one and rename/delete on hover.
 */
export function MailNav({
  folders,
  active,
  starredCount,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: {
  folders: MailFolder[];
  active: string;
  starredCount?: number;
  onSelect: (path: string) => void;
  onCreate: () => void;
  onRename: (folder: MailFolder) => void;
  onDelete: (folder: MailFolder) => void;
}) {
  const { standard, custom } = splitFolders(folders);
  const rows: Row[] = [];
  for (const f of standard) {
    rows.push(rowFor(f));
    if (f.specialUse === "inbox") {
      rows.push({
        key: STARRED,
        label: "Starred",
        icon: Star,
        count: starredCount ?? 0,
        countLabel: `${starredCount ?? 0} starred`,
        loud: false,
        custom: false,
      });
    }
  }
  return (
    <nav className="flex flex-col gap-3 px-2 py-2" aria-label="Folders">
      <div className="flex flex-col gap-px">
        {rows.map((row) => (
          <NavRow
            key={row.key}
            row={row}
            on={row.key === active}
            onSelect={() => onSelect(row.key)}
          />
        ))}
      </div>
      <div className="flex flex-col gap-px">
        <div className="text-muted-foreground flex h-7 items-center justify-between pr-0.5 pl-2 text-xs">
          <span>Folders</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="New folder"
                onClick={onCreate}
              >
                <FolderPlus className="size-3.5" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">New folder</TooltipContent>
          </Tooltip>
        </div>
        {custom.length === 0 ? (
          <button
            type="button"
            onClick={onCreate}
            className="text-muted-foreground hover:text-foreground rounded-md px-2 py-1.5 text-left text-xs"
          >
            Sort mail into folders of your own.
          </button>
        ) : (
          custom.map((f) => (
            <NavRow
              key={f.path}
              row={rowFor(f)}
              on={f.path === active}
              onSelect={() => onSelect(f.path)}
              onRename={() => onRename(f)}
              onDelete={() => onDelete(f)}
            />
          ))
        )}
      </div>
    </nav>
  );
}
