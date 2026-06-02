"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "@/i18n/navigation";
import { CtaButton } from "@/components/ui/cta-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Mirrors ENROLLMENT_TRANSITIONS (kept local so this client comp pulls no server code).
const TRANSITIONS: Record<string, string[]> = {
  pending: ["active", "cancelled"],
  active: ["refunded", "cancelled"],
  cancelled: [],
  refunded: [],
};

const LABEL: Record<string, string> = {
  active: "Mark paid & activate",
  cancelled: "Cancel enrollment",
  refunded: "Refund enrollment",
};

const cardStyle: CSSProperties = {
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  borderRadius: "var(--r-lg)",
  padding: "var(--s-5)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--s-4)",
};

export function EnrollmentActions({
  enrollmentId,
  status,
}: {
  enrollmentId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const allowed = TRANSITIONS[status] ?? [];

  async function transition(to: string) {
    setBusy(to);
    setError(null);
    try {
      const body: Record<string, unknown> = { to };
      if (note.trim()) body.note = note.trim();
      const res = await fetch(
        `/api/admin/academy/enrollments/${enrollmentId}/transition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(
          json?.error?.message ?? json?.error?.code ?? "Transition failed.",
        );
        return;
      }
      setNote("");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section style={cardStyle}>
      <h2
        style={{
          margin: 0,
          fontFamily: "var(--font-display)",
          fontSize: "var(--fs-lg)",
          color: "var(--color-text-strong)",
        }}
      >
        Actions
      </h2>
      {error && (
        <p
          role="alert"
          style={{
            margin: 0,
            color: "var(--color-error)",
            fontSize: "var(--fs-sm)",
          }}
        >
          {error}
        </p>
      )}
      {allowed.length === 0 ? (
        <p
          style={{
            margin: 0,
            color: "var(--color-text-muted)",
            fontSize: "var(--fs-sm)",
          }}
        >
          No further transitions available from <strong>{status}</strong>.
        </p>
      ) : (
        <>
          <div>
            <Label htmlFor="enr-note">Note (optional)</Label>
            <Input
              id="enr-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Internal note"
            />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-3)" }}>
            {allowed.map((to) => (
              <CtaButton
                key={to}
                variant={
                  to === "cancelled" || to === "refunded"
                    ? "secondary"
                    : "primary"
                }
                onClick={() => transition(to)}
              >
                {busy === to ? "Working…" : (LABEL[to] ?? to)}
              </CtaButton>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
