"use client";

import { useState } from "react";

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
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--r-lg)",
        background: "var(--color-surface)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={toggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--s-3)",
          padding: "var(--s-4)",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "left",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            aria-hidden
            style={{
              color: "var(--color-text-muted)",
              transform: open ? "rotate(90deg)" : "none",
              transition: "transform 150ms",
            }}
          >
            ›
          </span>
          <span style={{ fontWeight: 600, color: "var(--color-text-strong)" }}>
            {label}
          </span>
          <code
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--fs-caption)",
              color: "var(--color-text-muted)",
            }}
          >
            {name}
          </code>
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-body-sm)",
            color:
              count > 0
                ? "var(--color-text-strong)"
                : "var(--color-text-muted)",
          }}
        >
          {count} {count === 1 ? "doc" : "docs"}
        </span>
      </button>

      {open && (
        <div
          style={{
            borderTop: "1px solid var(--color-border)",
            padding: "var(--s-4)",
            display: "grid",
            gap: "var(--s-4)",
          }}
        >
          {error && (
            <p
              style={{
                margin: 0,
                color: "var(--color-error)",
                fontSize: "var(--fs-sm)",
              }}
            >
              {error}
            </p>
          )}

          {loading ? (
            <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
              Loading…
            </p>
          ) : rows && rows.length > 0 ? (
            <div style={{ display: "grid", gap: 4 }}>
              {rows.map((r) => (
                <div
                  key={r.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--s-3)",
                    padding: "6px 8px",
                    borderBottom: "1px solid var(--color-border)",
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.label}
                    {r.deleted && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: "var(--fs-caption)",
                          color: "var(--color-secondary-deep)",
                        }}
                      >
                        (soft-deleted)
                      </span>
                    )}
                  </span>
                  <code
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--fs-micro)",
                      color: "var(--color-text-subtle)",
                    }}
                  >
                    {r.id.slice(-6)}
                  </code>
                  <button
                    type="button"
                    onClick={() => deleteOne(r.id)}
                    disabled={busyId === r.id}
                    style={{
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--r-sm)",
                      background: "transparent",
                      color: "var(--color-error)",
                      padding: "3px 10px",
                      fontSize: "var(--fs-small)",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {busyId === r.id ? "…" : "Delete"}
                  </button>
                </div>
              ))}
              {count > rows.length && (
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: "var(--fs-caption)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  Showing the {rows.length} most recent of {count}. Use “Purge
                  all” to remove everything.
                </p>
              )}
            </div>
          ) : (
            <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
              No records.
            </p>
          )}

          {/* Purge */}
          {count > 0 && (
            <div
              style={{
                display: "grid",
                gap: 8,
                paddingTop: "var(--s-3)",
                borderTop: "1px dashed var(--color-border)",
              }}
            >
              <span
                style={{
                  fontSize: "var(--fs-caption)",
                  color: "var(--color-text-muted)",
                }}
              >
                Type{" "}
                <code
                  style={{
                    fontFamily: "var(--font-mono)",
                    color: "var(--color-error)",
                  }}
                >
                  {name}
                </code>{" "}
                to enable purge:
              </span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={name}
                  style={{
                    font: "inherit",
                    padding: "6px 10px",
                    border: "1px solid var(--color-border-field)",
                    borderRadius: "var(--r-sm)",
                    background: "var(--color-surface)",
                  }}
                />
                <button
                  type="button"
                  disabled={!confirmed || purging}
                  onClick={() => purge(false)}
                  style={{
                    border: "none",
                    borderRadius: "var(--r-sm)",
                    background: confirmed
                      ? "var(--color-error)"
                      : "var(--color-border)",
                    color: "#fff",
                    padding: "6px 14px",
                    fontWeight: 600,
                    cursor: confirmed ? "pointer" : "not-allowed",
                    fontFamily: "inherit",
                  }}
                >
                  {purging ? "Purging…" : `Purge all ${count}`}
                </button>
                {softDelete && (
                  <button
                    type="button"
                    disabled={!confirmed || purging}
                    onClick={() => purge(true)}
                    style={{
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--r-sm)",
                      background: "transparent",
                      color: "var(--color-text)",
                      padding: "6px 14px",
                      cursor: confirmed ? "pointer" : "not-allowed",
                      fontFamily: "inherit",
                    }}
                  >
                    Purge soft-deleted only
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
