"use client";

import {
  ChevronLeft,
  ChevronRight,
  Folder,
  Paperclip,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { cn } from "@/lib/cn";
import type { MailListItem } from "@/lib/mail/store/types";
import { personLabel, timeAgo } from "./mail-shared";
import { Mail, ShieldAlert } from "lucide-react";

export type Selection = { folder: string; uid: number };

export const sameRow = (a: Selection | null, b: Selection) =>
  a !== null && a.folder === b.folder && a.uid === b.uid;

/** The message cards. Selected = filled; unread = the whole card tinted blue. */
export function MailList({
  items,
  selected,
  onSelect,
  folderNames,
  loading,
  fetching,
  error,
  emptyTitle,
  emptyHint,
  page,
  pages,
  onPage,
}: {
  items: MailListItem[];
  selected: Selection | null;
  onSelect: (row: Selection) => void;
  /** Set when the list spans folders (Starred): each card names its folder. */
  folderNames?: Map<string, string>;
  loading: boolean;
  fetching: boolean;
  error: string | null;
  emptyTitle: string;
  emptyHint: string;
  page: number;
  pages: number;
  onPage: (page: number) => void;
}) {
  return (
    <>
      <ScrollArea className="min-h-0 flex-1">
        {loading ? (
          <div className="flex flex-col gap-2 p-4 pt-0">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="grid gap-2 rounded-lg border p-3">
                <div className="flex items-center">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="ml-auto h-3 w-16" />
                </div>
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={ShieldAlert}
            title="Could not load this folder"
            description={error}
            className="my-8"
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Mail}
            title={emptyTitle}
            description={emptyHint}
            className="my-8"
          />
        ) : (
          <div
            className={cn(
              "flex flex-col gap-2 p-4 pt-0 transition-opacity",
              fetching && "opacity-70",
            )}
          >
            {items.map((item) => {
              const on = sameRow(selected, item);
              return (
                <button
                  key={`${item.folder}:${item.uid}`}
                  type="button"
                  onClick={() =>
                    onSelect({ folder: item.folder, uid: item.uid })
                  }
                  aria-current={on ? "true" : undefined}
                  aria-label={item.seen ? undefined : `Unread: ${item.subject}`}
                  className={cn(
                    "hover:bg-accent flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all",
                    !item.seen && "border-sky-500/40 bg-sky-500/10",
                    on && "bg-accent",
                  )}
                >
                  <div className="flex w-full flex-col gap-1">
                    <div className="flex items-center">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="truncate font-semibold">
                          {personLabel(item.from)}
                        </div>
                      </div>
                      <div
                        className={cn(
                          "ml-auto flex shrink-0 items-center gap-1.5 text-xs",
                          on ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {item.hasAttachments && (
                          <Paperclip
                            className="size-3"
                            aria-label="Has attachment"
                          />
                        )}
                        {item.flagged && (
                          <Star
                            className="size-3 fill-[var(--tone-warning)] text-[var(--tone-warning-fg)]"
                            aria-label="Starred"
                          />
                        )}
                        <span className="whitespace-nowrap">
                          {timeAgo(item.date)}
                        </span>
                      </div>
                    </div>
                    {folderNames && (
                      <div className="text-muted-foreground flex items-center gap-1 text-xs">
                        <Folder className="size-3" aria-hidden />
                        {folderNames.get(item.folder) ?? item.folder}
                      </div>
                    )}
                    <div className="line-clamp-1 text-xs font-medium">
                      {item.subject}
                    </div>
                  </div>
                  {item.preview && (
                    <div className="text-muted-foreground line-clamp-2 text-xs">
                      {item.preview}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
      {pages > 1 && (
        <div className="flex shrink-0 items-center justify-between border-t px-4 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={page <= 1 || fetching}
            onClick={() => onPage(page - 1)}
          >
            <ChevronLeft className="size-4" aria-hidden />
            Newer
          </Button>
          <span className="text-muted-foreground text-xs">
            {page} / {pages}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={page >= pages || fetching}
            onClick={() => onPage(page + 1)}
          >
            Older
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      )}
    </>
  );
}
