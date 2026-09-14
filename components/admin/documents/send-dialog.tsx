"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import type { SlotRef } from "@/lib/documents/slots";
import { useEmployees } from "./people-picker";

/**
 * Send: who signs (the people in the slots — fixed), who else reads it, a
 * line for the mail. What happens is spelled out, because it cannot be
 * undone: the number is taken and the text locks.
 */
export function SendDialog({
  open,
  slots,
  typeLabel,
  busy,
  onCancel,
  onSend,
}: {
  open: boolean;
  slots: SlotRef[];
  typeLabel: string;
  busy: boolean;
  onCancel: () => void;
  onSend: (input: { acknowledgers: string[]; message: string }) => void;
}) {
  const { status, people } = useEmployees(open);
  const [readers, setReaders] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");

  const signerIds = new Set(slots.map((s) => s.employeeId));
  const signers = [...signerIds].map((id) => ({
    id,
    name: slots.find((s) => s.employeeId === id)?.name ?? "",
    person: people.find((p) => p.id === id) ?? null,
  }));
  const others = people.filter((p) => !signerIds.has(p.id));

  function toggle(id: string, on: boolean) {
    setReaders((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send this {typeLabel.toLowerCase()}</DialogTitle>
          <DialogDescription>
            It gets its number, the text locks, the PDF is filed in the vault,
            and everyone below is told in their portal and by mail.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Signs</Label>
            {signers.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No signature slots in the text. Insert one from the ribbon if
                someone should sign; otherwise it is filed as final when sent.
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {signers.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="text-foreground block truncate font-medium">
                        {s.person?.name ?? s.name}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {s.person?.designation ?? "signature slot"}
                      </span>
                    </span>
                    {status === "ready" &&
                      (s.person ? (
                        s.person.hasSignature ? (
                          <StatusBadge tone="success" dot={false}>
                            signature on file
                          </StatusBadge>
                        ) : (
                          <StatusBadge tone="warning" dot={false}>
                            will be asked to add one
                          </StatusBadge>
                        )
                      ) : (
                        <StatusBadge tone="danger" dot={false}>
                          not an active employee
                        </StatusBadge>
                      ))}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Also reads it</Label>
            <p className="text-muted-foreground text-xs">
              They acknowledge that they have read it; nothing to sign.
            </p>
            <div className="max-h-44 overflow-y-auto rounded-md border">
              {status === "loading" ? (
                <p className="text-muted-foreground p-3 text-sm">
                  Loading people…
                </p>
              ) : others.length === 0 ? (
                <p className="text-muted-foreground p-3 text-sm">
                  No one else to add.
                </p>
              ) : (
                others.map((p) => (
                  <Label
                    key={p.id}
                    className="hover:bg-muted/60 flex cursor-pointer items-center gap-3 px-3 py-2 font-normal"
                  >
                    <Checkbox
                      checked={readers.has(p.id)}
                      onCheckedChange={(c) => toggle(p.id, c === true)}
                    />
                    <span className="min-w-0">
                      <span className="text-foreground block truncate text-sm">
                        {p.name}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {p.designation}
                      </span>
                    </span>
                  </Label>
                ))
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="send-message">A line for the mail (optional)</Label>
            <Textarea
              id="send-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder="Please sign by Friday."
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={
              busy || signers.some((s) => status === "ready" && !s.person)
            }
            onClick={() => onSend({ acknowledgers: [...readers], message })}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {signers.length === 0 && readers.size === 0
              ? "Send and file"
              : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
