"use client";

import { useState } from "react";
import { ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

type Row = {
  id: string;
  label: string;
  createdAt: string | null;
  deleted: boolean;
};

export function MaintenancePanel({
  name,
  label,
  softDelete,
  initialCount,
}: {
  name: string;
  label: string;
  softDelete: boolean;
  initialCount: number;
}) {
  const [count, setCount] = useState(initialCount);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [purging, setPurging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && rows === null) await load();
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/hard-delete?collection=${name}&limit=25`,
      );
      const json = await res.json();
      if (res.ok && json.ok) setRows(json.data.items);
      else setError(json?.error?.code ?? "load_failed");
    } catch {
      setError("network_error");
    } finally {
      setLoading(false);
    }
  }

  async function deleteOne(id: string) {
    if (
      !window.confirm(
        `Permanently delete this ${label} record? This cannot be undone.`,
      )
    )
      return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/hard-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collection: name, id }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setRows((r) => (r ? r.filter((x) => x.id !== id) : r));
        setCount((c) => Math.max(0, c - (json.data.deletedCount ?? 1)));
      } else {
        setError(json?.error?.code ?? "delete_failed");
      }
    } catch {
      setError("network_error");
    } finally {
      setBusyId(null);
    }
  }

  async function purge(softOnly: boolean) {
    setPurging(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/hard-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection: name,
          purge: true,
          confirm: confirmText.trim(),
          softOnly,
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        const removed = json.data.deletedCount ?? 0;
        if (softOnly) {
          await load();
          setCount((c) => Math.max(0, c - removed));
        } else {
          setRows([]);
          setCount(0);
        }
        setConfirmText("");
      } else {
        setError(
          json?.error?.code === "confirm_mismatch"
            ? "Type the exact collection name to confirm."
            : (json?.error?.code ?? "purge_failed"),
        );
      }
    } catch {
      setError("network_error");
    } finally {
      setPurging(false);
    }
  }

  const confirmed = confirmText.trim() === name;

  return (
    <div className="bg-card overflow-hidden rounded-lg shadow-[var(--shadow-sm)]">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="hover:bg-muted/50 flex w-full items-center justify-between gap-3 p-4 text-left transition-colors"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <ChevronRight
            aria-hidden
            className={cn(
              "text-muted-foreground size-4 shrink-0 transition-transform duration-150",
              open && "rotate-90",
            )}
          />
          <span className="text-foreground truncate text-[13px] font-semibold">
            {label}
          </span>
          <code className="text-muted-foreground truncate font-mono text-xs">
            {name}
          </code>
        </span>
        <span
          className={cn(
            "shrink-0 font-mono text-[13px] tabular-nums",
            count > 0 ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {count} {count === 1 ? "doc" : "docs"}
        </span>
      </button>

      {open && (
        <div className="border-border/60 grid gap-4 border-t p-4">
          {error && (
            <p role="alert" className="text-destructive text-[13px]">
              {error}
            </p>
          )}

          {loading ? (
            <p className="text-muted-foreground text-[13px]">Loading…</p>
          ) : rows && rows.length > 0 ? (
            <div className="grid gap-1">
              <div className="divide-border/60 divide-y">
                {rows.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-2 py-1">
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      {r.label}
                      {r.deleted && (
                        <span className="ml-2 text-xs text-[var(--color-secondary-deep)]">
                          (soft-deleted)
                        </span>
                      )}
                    </span>
                    <code className="text-muted-foreground shrink-0 font-mono text-[11px]">
                      {r.id.slice(-6)}
                    </code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteOne(r.id)}
                      disabled={busyId === r.id}
                      aria-label={`Permanently delete ${r.label}`}
                      title="Delete permanently"
                    >
                      <Trash2
                        className={cn(busyId === r.id && "animate-pulse")}
                      />
                    </Button>
                  </div>
                ))}
              </div>
              {count > rows.length && (
                <p className="text-muted-foreground pt-1 text-xs">
                  Showing the {rows.length} most recent of {count}. Use “Purge
                  all” to remove everything.
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-[13px]">No records.</p>
          )}

          {/* Purge */}
          {count > 0 && (
            <div className="border-border/60 grid gap-2 border-t border-dashed pt-3">
              <span className="text-muted-foreground text-xs">
                Type <code className="text-destructive font-mono">{name}</code>{" "}
                to enable purge:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={name}
                  aria-label={`Type ${name} to confirm the purge`}
                  className="h-8 w-auto max-w-[15rem]"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={!confirmed || purging}
                  onClick={() => purge(false)}
                >
                  {purging ? "Purging…" : `Purge all ${count}`}
                </Button>
                {softDelete && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!confirmed || purging}
                    onClick={() => purge(true)}
                  >
                    Purge soft-deleted only
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
