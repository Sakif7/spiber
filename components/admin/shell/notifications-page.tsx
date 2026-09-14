"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellOff, CheckCheck, Mail } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { cn } from "@/lib/cn";
import { MAIL_ARRIVED_EVENT } from "@/components/admin/mail/mail-shared";

/**
 * Everything the bell would show, without the 30-row cut: the latest
 * business events (admins) and every unread message in the person's
 * mailboxes, grouped by day. Same API as the bell, same "mark read" rules.
 */
type Item = {
  id: string;
  kind: "event" | "mail";
  title: string;
  body: string | null;
  href: string;
  severity: "info" | "success" | "warning";
  entityRef: string | null;
  createdAt: string;
  read: boolean;
};
type Feed = { unread: number; unreadMail: number; items: Item[] };

const SEVERITY_DOT: Record<Item["severity"], string> = {
  info: "bg-sky-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
};

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

const KEY = ["admin", "notifications", "all"] as const;

async function fetchFeed(): Promise<Feed> {
  const res = await fetch("/api/admin/notifications?limit=100&fresh=1", {
    cache: "no-store",
  });
  const json = (await res.json()) as { ok: boolean; data?: Feed };
  if (!res.ok || !json.ok || !json.data) throw new Error("load failed");
  return json.data;
}

export function NotificationsPage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: KEY, queryFn: fetchFeed });
  const feed = query.data ?? null;
  const error = query.isError
    ? "Could not load notifications. Try again in a moment."
    : null;
  const [busy, setBusy] = useState(false);

  // New mail noticed by the bell or the mail page: show it here too.
  useEffect(() => {
    const refresh = () => qc.invalidateQueries({ queryKey: KEY });
    window.addEventListener(MAIL_ARRIVED_EVENT, refresh);
    return () => window.removeEventListener(MAIL_ARRIVED_EVENT, refresh);
  }, [qc]);

  async function markAll() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) throw new Error();
      toast.success("All notifications marked read.");
      window.dispatchEvent(new Event(MAIL_ARRIVED_EVENT));
      await qc.invalidateQueries({ queryKey: KEY });
    } catch {
      toast.error("Could not mark everything read.");
    } finally {
      setBusy(false);
    }
  }

  function markOne(item: Item) {
    if (item.read) return;
    void fetch("/api/admin/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [item.id] }),
    });
    qc.setQueryData<Feed>(KEY, (f) =>
      f
        ? {
            ...f,
            unread: Math.max(0, f.unread - 1),
            unreadMail:
              item.kind === "mail"
                ? Math.max(0, f.unreadMail - 1)
                : f.unreadMail,
            items: f.items.map((it) =>
              it.id === item.id ? { ...it, read: true } : it,
            ),
          }
        : f,
    );
  }

  const groups = new Map<string, Item[]>();
  for (const it of feed?.items ?? []) {
    const k = dayLabel(it.createdAt);
    groups.set(k, [...(groups.get(k) ?? []), it]);
  }
  const unread = feed?.unread ?? 0;

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Notifications"
        description={
          feed
            ? unread > 0
              ? `${unread} unread — new mail, orders, quotes and leads.`
              : "You're up to date."
            : "New mail, orders, quotes and leads."
        }
        action={
          unread > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void markAll()}
            >
              <CheckCheck className="size-4" aria-hidden />
              Mark all read
            </Button>
          ) : null
        }
      />
      {error ? (
        <EmptyState
          icon={BellOff}
          title="Nothing to show"
          description={error}
        />
      ) : !feed ? (
        <div className="grid gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : feed.items.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="Nothing yet"
          description="New mail, orders and leads will show up here."
        />
      ) : (
        <div className="space-y-5">
          {[...groups].map(([day, items]) => (
            <section key={day} className="space-y-1.5">
              <h2 className="text-muted-foreground text-xs font-medium">
                {day}
              </h2>
              <ul className="bg-card divide-border divide-y rounded-md border">
                {items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={() => markOne(item)}
                      className={cn(
                        "hover:bg-accent/60 flex items-start gap-3 px-4 py-3 transition-colors",
                        !item.read && "bg-accent/30",
                      )}
                    >
                      {item.kind === "mail" ? (
                        <Mail
                          aria-hidden
                          className="text-primary mt-0.5 size-4 shrink-0"
                        />
                      ) : (
                        <span
                          aria-hidden
                          className={cn(
                            "mt-1.5 size-2 shrink-0 rounded-full",
                            item.read
                              ? "bg-border"
                              : SEVERITY_DOT[item.severity],
                          )}
                        />
                      )}
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block truncate text-sm",
                            item.read ? "text-muted-foreground" : "font-medium",
                          )}
                        >
                          {item.title}
                        </span>
                        {item.body && (
                          <span className="text-muted-foreground block truncate text-xs">
                            {item.body}
                          </span>
                        )}
                      </span>
                      <time
                        className="text-muted-foreground shrink-0 text-xs tabular-nums"
                        dateTime={item.createdAt}
                      >
                        {time(item.createdAt)}
                      </time>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
