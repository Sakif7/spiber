"use client";

import { useState } from "react";
import { Loader2, MessageSquareText } from "lucide-react";
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
import type { ReviewerView } from "@/lib/services/documents/document-review.service";
import { useEmployees, type PickableEmployee } from "./people-picker";

/**
 * Ask people to read the draft and comment. Directors come first — they
 * are the reviewers the company means — but anyone with a login can be
 * asked. Someone already asked is shown with where they got to.
 */
export function ReviewDialog({
  open,
  reviewers,
  busy,
  onCancel,
  onAsk,
}: {
  open: boolean;
  reviewers: ReviewerView[];
  busy: boolean;
  onCancel: () => void;
  onAsk: (input: { reviewers: string[]; message: string }) => void;
}) {
  const { status, people } = useEmployees(open);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");

  const directors = people.filter((p) => p.kind === "director");
  const others = people.filter((p) => p.kind !== "director");
  const asked = new Map(
    reviewers.filter((r) => r.employeeId).map((r) => [r.employeeId, r]),
  );

  function toggle(id: string, on: boolean) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const row = (p: PickableEmployee) => {
    const was = asked.get(p.id);
    return (
      <Label
        key={p.id}
        className="hover:bg-muted/60 flex cursor-pointer items-center gap-3 px-3 py-2 font-normal"
      >
        <Checkbox
          checked={picked.has(p.id)}
          onCheckedChange={(c) => toggle(p.id, c === true)}
        />
        <span className="min-w-0 flex-1">
          <span className="text-foreground block truncate text-sm">
            {p.name}
          </span>
          <span className="text-muted-foreground block truncate text-xs">
            {p.designation}
          </span>
        </span>
        {was && (
          <StatusBadge
            tone={was.status === "done" ? "success" : "warning"}
            dot={false}
          >
            {was.status === "done" ? "reviewed" : "asked"}
          </StatusBadge>
        )}
      </Label>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ask for a review</DialogTitle>
          <DialogDescription>
            They read the draft in their portal and comment on the words they
            select; you answer and resolve. The document stays editable, and
            sending it ends the review.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Directors</Label>
            <div className="max-h-44 overflow-y-auto rounded-md border">
              {status === "loading" ? (
                <p className="text-muted-foreground p-3 text-sm">
                  Loading people…
                </p>
              ) : directors.length === 0 ? (
                <p className="text-muted-foreground p-3 text-sm">
                  No directors on the Employees page yet.
                </p>
              ) : (
                directors.map(row)
              )}
            </div>
          </div>
          {others.length > 0 && (
            <div className="space-y-1.5">
              <Label>Others</Label>
              <div className="max-h-36 overflow-y-auto rounded-md border">
                {others.map(row)}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="review-message">
              A line for the mail (optional)
            </Label>
            <Textarea
              id="review-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder="Comments by Thursday, please."
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
            disabled={busy || picked.size === 0}
            onClick={() => onAsk({ reviewers: [...picked], message })}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MessageSquareText className="size-4" />
            )}
            Ask {picked.size || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
