"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "@/i18n/navigation";
import {
  Bell,
  BellOff,
  CheckCheck,
  Mail,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type FeedItem = {
  id: string;
  /** A business event row, or an unread message in one of my mailboxes. */
  kind: "event" | "mail";
  type: string;
  title: string;
  body: string | null;
  href: string;
  severity: "info" | "success" | "warning";
  entityRef: string | null;
  createdAt: string;
  read: boolean;
};
type Feed = { unread: number; unreadMail: number; items: FeedItem[] };

const POLL_MS = 30_000;
const SOUND_KEY = "spiber-admin-notify-sound";
const SOUND_EVENT = "spiber-admin-notify-sound-changed";

function subscribeSound(cb: () => void) {
  window.addEventListener(SOUND_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(SOUND_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
function readSoundOn() {
  return (
    typeof window !== "undefined" && localStorage.getItem(SOUND_KEY) !== "0"
  );
}

/**
 * Two-tone WebAudio chime — no audio asset to ship. Browsers keep the
 * AudioContext suspended until the user has interacted with the page, so the
 * chime simply stays silent (never errors) before the first click/keypress.
 */
function playChime() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    if (ctx.state === "suspended") {
      void ctx.close();
      return;
    }
    const now = ctx.currentTime;
    for (const [freq, at] of [
      [880, 0],
      [1174.66, 0.12],
    ] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.08, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.35);
    }
    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    // Sound is a nicety — never let it break the bell.
  }
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const SEVERITY_DOT: Record<FeedItem["severity"], string> = {
  info: "bg-sky-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
};

export function NotificationBell() {
  const router = useRouter();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [open, setOpen] = useState(false);
  const soundOn = useSyncExternalStore(subscribeSound, readSoundOn, () => true);
  // Ids seen on the previous poll — lets us tell genuinely-new events apart
  // from the initial load (which must not toast/chime).
  const seenIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/admin/notifications", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as { ok: boolean; data?: Feed };
        if (!json.ok || !json.data || cancelled) return;
        const next = json.data;

        const prev = seenIds.current;
        if (prev) {
          const fresh = next.items.filter((it) => !prev.has(it.id) && !it.read);
          if (fresh.length > 0) {
            if (readSoundOn()) playChime();
            for (const it of fresh.slice(0, 3)) {
              toast(it.title, {
                description: it.body ?? undefined,
                action: {
                  label: "View",
                  onClick: () => router.push(it.href),
                },
              });
            }
            if (fresh.length > 3) {
              toast(`…and ${fresh.length - 3} more new notifications`);
            }
          }
        }
        seenIds.current = new Set(next.items.map((it) => it.id));
        setFeed(next);
      } catch {
        // Offline / server restart — try again on the next tick.
      }
    }

    void poll();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, POLL_MS);
    const onFocus = () => void poll();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [router]);

  // Mail is read by opening it in the mailbox, never from here: "Mark all
  // read" clears business events and leaves the unread-mail count alone.
  function markRead(ids: string[] | "all") {
    void fetch("/api/admin/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids === "all" ? { all: true } : { ids }),
    });
    setFeed((f) =>
      f
        ? {
            ...f,
            unread:
              ids === "all"
                ? f.unreadMail
                : Math.max(
                    0,
                    f.unread -
                      f.items.filter((it) => ids.includes(it.id) && !it.read)
                        .length,
                  ),
            items: f.items.map((it) =>
              it.kind === "event" && (ids === "all" || ids.includes(it.id))
                ? { ...it, read: true }
                : it,
            ),
          }
        : f,
    );
  }

  function openItem(item: FeedItem) {
    if (item.kind === "event" && !item.read) markRead([item.id]);
    setOpen(false);
    router.push(item.href);
  }

  const unread = feed?.unread ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            unread > 0 ? `Notifications (${unread} unread)` : "Notifications"
          }
          className="relative"
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span
              aria-hidden
              className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.625rem] leading-none font-semibold"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-96 max-w-[92vw] p-0"
      >
        <div className="border-border flex items-center justify-between gap-2 border-b px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground size-7"
              aria-label={
                soundOn
                  ? "Mute notification sound"
                  : "Unmute notification sound"
              }
              title={soundOn ? "Sound on" : "Sound off"}
              onClick={() => {
                localStorage.setItem(SOUND_KEY, soundOn ? "0" : "1");
                window.dispatchEvent(new Event(SOUND_EVENT));
              }}
            >
              {soundOn ? (
                <Volume2 className="size-4" />
              ) : (
                <VolumeX className="size-4" />
              )}
            </Button>
            {unread > (feed?.unreadMail ?? 0) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground h-7 gap-1 px-2 text-xs"
                onClick={() => markRead("all")}
              >
                <CheckCheck className="size-3.5" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-[min(60vh,24rem)] overflow-y-auto overscroll-contain">
          {!feed && (
            <p className="text-muted-foreground px-3 py-8 text-center text-sm">
              Loading…
            </p>
          )}
          {feed && feed.items.length === 0 && (
            <div className="text-muted-foreground flex flex-col items-center gap-2 px-3 py-8 text-center text-sm">
              <BellOff className="size-5 opacity-60" aria-hidden />
              Nothing yet — new mail, orders and leads will show up here.
            </div>
          )}
          {feed?.items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openItem(item)}
              className={cn(
                "hover:bg-accent/60 flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors",
                !item.read && "bg-accent/30",
              )}
            >
              {item.kind === "mail" ? (
                <Mail
                  aria-hidden
                  className="text-primary mt-0.5 size-3.5 shrink-0"
                />
              ) : (
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    item.read ? "bg-border" : SEVERITY_DOT[item.severity],
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
                <span className="text-muted-foreground/70 mt-0.5 block text-[0.6875rem]">
                  {timeAgo(item.createdAt)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
