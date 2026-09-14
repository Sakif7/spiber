"use client";

import { useMemo, useState } from "react";
import { PenLine, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/admin/ui/select-field";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { cn } from "@/lib/cn";
import { useEmployees, type PickableEmployee } from "./people-picker";

export const SLOT_LABELS = [
  "Signature",
  "Countersigned",
  "Approved by",
  "Acknowledged by",
  "Witnessed by",
] as const;

/**
 * Place a signature slot: whose, and what the line under it says. The
 * person becomes a signer when the document is sent; their stored
 * signature fills the slot when they acknowledge it.
 */
export function SignatureSlotDialog({
  open,
  onCancel,
  onInsert,
}: {
  open: boolean;
  onCancel: () => void;
  onInsert: (slot: {
    employeeId: string;
    name: string;
    title: string;
    label: string;
  }) => void;
}) {
  const { status, people } = useEmployees(open);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<PickableEmployee | null>(null);
  const [label, setLabel] = useState<string>(SLOT_LABELS[0]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle
      ? people.filter(
          (p) =>
            p.name.toLowerCase().includes(needle) ||
            p.designation.toLowerCase().includes(needle),
        )
      : people;
  }, [people, q]);

  function close() {
    setPicked(null);
    setQ("");
    onCancel();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Signature slot</DialogTitle>
          <DialogDescription>
            Choose who signs here. Their signature is placed when they
            acknowledge the document in their portal.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search people…"
              className="pl-8"
              aria-label="Search people"
              autoFocus
            />
          </div>
          <div
            role="listbox"
            aria-label="People"
            className="max-h-64 overflow-y-auto rounded-md border"
          >
            {status === "loading" ? (
              <p className="text-muted-foreground p-3 text-sm">
                Loading people…
              </p>
            ) : status === "error" ? (
              <p className="text-destructive p-3 text-sm">
                Could not load the people.
              </p>
            ) : shown.length === 0 ? (
              <p className="text-muted-foreground p-3 text-sm">
                {people.length === 0
                  ? "No active employees yet."
                  : "No one matches."}
              </p>
            ) : (
              shown.map((p) => {
                const active = picked?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => setPicked(p)}
                    className={cn(
                      "hover:bg-muted/60 flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm",
                      active && "bg-primary/10",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="text-foreground block truncate font-medium">
                        {p.name}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {p.designation}
                        {p.kind === "director" ? " · Director" : ""}
                      </span>
                    </span>
                    {p.hasSignature ? (
                      <StatusBadge tone="success" dot={false}>
                        signature on file
                      </StatusBadge>
                    ) : (
                      <StatusBadge tone="warning" dot={false}>
                        no signature yet
                      </StatusBadge>
                    )}
                  </button>
                );
              })
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Line under the signature</Label>
            <SelectField
              value={label}
              onChange={setLabel}
              options={SLOT_LABELS.map((l) => ({ value: l, label: l }))}
            />
          </div>
          {picked && !picked.hasSignature && (
            <p className="text-muted-foreground text-xs">
              {picked.name} has no signature on file yet. They will be asked to
              add one in their portal before they can sign.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!picked}
            onClick={() => {
              if (!picked) return;
              onInsert({
                employeeId: picked.id,
                name: picked.name,
                title: picked.designation,
                label,
              });
              close();
            }}
          >
            <PenLine className="size-4" /> Insert slot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
