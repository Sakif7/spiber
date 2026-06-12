"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type ChecklistKey =
  | "appointment"
  | "visa"
  | "airTicket"
  | "accommodation"
  | "airportTransfer";

const ITEMS: { key: ChecklistKey; label: string }[] = [
  { key: "appointment", label: "Appointment" },
  { key: "visa", label: "Visa" },
  { key: "airTicket", label: "Air ticket" },
  { key: "accommodation", label: "Accommodation" },
  { key: "airportTransfer", label: "Airport transfer" },
];

type ChecklistState = Record<ChecklistKey, { done: boolean; note?: string }>;

export function CaseChecklist({
  caseId,
  initial,
}: {
  caseId: string;
  initial: ChecklistState;
}) {
  const router = useRouter();
  const [state, setState] = useState<ChecklistState>(initial);
  const [busy, setBusy] = useState<ChecklistKey | null>(null);

  async function toggle(key: ChecklistKey) {
    const next = !state[key]?.done;
    setBusy(key);
    setState((s) => ({ ...s, [key]: { ...s[key], done: next } }));
    try {
      const res = await fetch(`/api/admin/tourism/cases/${caseId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, done: next }),
      });
      if (res.ok) router.refresh();
      else setState(initial); // revert on failure
    } catch {
      setState(initial);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid">
      {ITEMS.map(({ key, label }, i) => {
        const done = state[key]?.done ?? false;
        return (
          <div
            key={key}
            className={cn(
              "flex items-center justify-between gap-3 py-2",
              i !== 0 && "border-border border-t",
            )}
          >
            <span
              className={cn(
                "text-sm",
                done ? "text-foreground" : "text-foreground/90",
              )}
            >
              {label}
              {state[key]?.note ? (
                <span className="text-muted-foreground ml-2 text-xs">
                  — {state[key]!.note}
                </span>
              ) : null}
            </span>
            <Button
              type="button"
              size="sm"
              variant={done ? "default" : "outline"}
              onClick={() => toggle(key)}
              disabled={busy === key}
              aria-pressed={done}
              className="rounded-full"
            >
              {done ? <Check size={13} aria-hidden /> : null}
              {busy === key ? "…" : done ? "Done" : "Mark done"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
