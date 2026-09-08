"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
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
    <section className="bg-card flex flex-col gap-4 rounded-lg border p-5">
      <h2 className="text-foreground m-0 font-[family-name:var(--font-display)] text-lg">
        Actions
      </h2>
      {error && (
        <p role="alert" className="text-destructive m-0 text-sm">
          {error}
        </p>
      )}
      {allowed.length === 0 ? (
        <p className="text-muted-foreground m-0 text-sm">
          No further transitions available from <strong>{status}</strong>.
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="enr-note">Note (optional)</Label>
            <Input
              id="enr-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Internal note"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            {allowed.map((to) => (
              <Button
                key={to}
                variant={
                  to === "cancelled" || to === "refunded"
                    ? "outline"
                    : "default"
                }
                onClick={() => transition(to)}
              >
                {busy === to ? "Working…" : (LABEL[to] ?? to)}
              </Button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
