"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function AppointmentActions({
  appointmentId,
  status,
  type,
  currentUserId,
  assignedToMe,
}: {
  appointmentId: string;
  status: string;
  type: string;
  currentUserId: string;
  assignedToMe: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");

  const allowed = TRANSITIONS[status] ?? [];

  async function call(
    path: string,
    body: Record<string, unknown>,
    tag: string,
  ) {
    setBusy(tag);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/tourism/appointments/${appointmentId}/${path}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error?.code ?? "Action failed.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Network error.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="bg-card flex flex-col gap-4 rounded-lg p-5 shadow-[var(--shadow-sm)]">
      <h2 className="text-foreground m-0 font-[family-name:var(--font-display)] text-lg">
        Actions
      </h2>
      {error && <p className="text-destructive m-0 text-sm">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={() =>
            call(
              "assign",
              { assignedTo: assignedToMe ? null : currentUserId },
              "assign",
            )
          }
        >
          {busy === "assign"
            ? "Working…"
            : assignedToMe
              ? "Unassign me"
              : "Assign to me"}
        </Button>
      </div>

      {/* Confirm + meeting link (teleconsultation pastes a Meet/Jitsi link) */}
      <div className="border-border grid gap-2 border-t pt-3">
        <strong className="text-foreground">Confirm &amp; schedule</strong>
        {type === "teleconsultation" && (
          <>
            <Label className="text-muted-foreground text-xs">
              Meeting link
            </Label>
            <Input
              type="url"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="https://meet.google.com/…"
            />
          </>
        )}
        <Label className="text-muted-foreground text-xs">Scheduled for</Label>
        <Input
          type="datetime-local"
          value={scheduledFor}
          onChange={(e) => setScheduledFor(e.target.value)}
        />
        <div>
          <Button
            onClick={async () => {
              // For in-person, a meeting link isn't required — fall back to confirm.
              if (type === "teleconsultation" && !meetingLink.trim()) {
                setError("A meeting link is required for teleconsultation.");
                return;
              }
              if (meetingLink.trim()) {
                const ok = await call(
                  "meeting-link",
                  {
                    meetingLink: meetingLink.trim(),
                    scheduledFor: scheduledFor || undefined,
                  },
                  "schedule",
                );
                if (ok) {
                  setMeetingLink("");
                  setScheduledFor("");
                }
              } else {
                await call("transition", { to: "confirmed" }, "schedule");
              }
            }}
          >
            {busy === "schedule" ? "Saving…" : "Confirm appointment"}
          </Button>
        </div>
      </div>

      {/* Internal note */}
      <div className="border-border grid gap-1.5 border-t pt-3">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add an internal note"
          rows={3}
        />
        <div>
          <Button
            variant="outline"
            onClick={async () => {
              if (!note.trim()) return;
              const ok = await call("note", { body: note.trim() }, "note");
              if (ok) setNote("");
            }}
          >
            {busy === "note" ? "Saving…" : "Add note"}
          </Button>
        </div>
      </div>

      {allowed.length === 0 ? (
        <p className="text-muted-foreground m-0 text-sm">
          No further transitions from <strong>{status}</strong>.
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {allowed.map((to) => (
            <Button
              key={to}
              variant={to === "confirmed" ? "default" : "outline"}
              onClick={() =>
                call(
                  "transition",
                  note.trim() ? { to, note: note.trim() } : { to },
                  to,
                )
              }
            >
              {busy === to ? "Working…" : `Move to ${to}`}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}
