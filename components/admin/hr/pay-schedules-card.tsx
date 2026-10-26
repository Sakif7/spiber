"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Archive, Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SectionCard } from "@/components/admin/ui/section-card";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { formatApiError } from "@/lib/http/form-error";
import type { Cycle } from "@/lib/hr/cycles";
import {
  CycleEditor,
  cycleOf,
  draftError,
  draftFromCycle,
  type CycleDraft,
} from "./cycle-editor";

export type ScheduleRow = {
  /** The id, or "default" while the default is the built-in one. */
  ref: string;
  name: string;
  description: string | null;
  cycleLabel: string;
  /** "From 1 Nov 2026: every 2 months" — a change that has not begun yet. */
  planned: string | null;
  currentPeriod: string;
  payday: string;
  people: number;
  isDefault: boolean;
  virtual: boolean;
  /** The cycle in force today, to start the edit from. */
  cycle: Cycle;
  paydayOffsetDays: number;
  /** The first day a new cycle may start: after every period paid. */
  floor: string | null;
  suggestedFrom: string;
  memberIds: string[];
};

export type PersonOption = { id: string; name: string; scheduleName: string };

type Mode = { kind: "new" } | { kind: "edit"; row: ScheduleRow };

const MESSAGES: Record<string, string> = {
  cycle_locked:
    "That day falls inside a period someone on this schedule was already paid for. Pick a later day.",
  has_people: "Move everyone onto another schedule first.",
  is_default: "Make another schedule the default first.",
  bad_people: "Someone picked is no longer on record. Refresh and try again.",
};

/**
 * Pay schedules: when each group of people is paid.
 *
 * One table, one dialog for new and edit. People are only ever moved ONTO a
 * schedule here — taking someone off means choosing where they go, which is
 * that schedule's job (or their own page's), so it is never a side effect of
 * unticking a box.
 */
export function PaySchedulesCard({
  schedules,
  people,
  newSuggestedFrom,
}: {
  schedules: ScheduleRow[];
  people: PersonOption[];
  /** Where a new schedule's start day begins. */
  newSuggestedFrom: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [offset, setOffset] = useState("0");
  const [makeDefault, setMakeDefault] = useState(false);
  const [changeCycle, setChangeCycle] = useState(true);
  const [draft, setDraft] = useState<CycleDraft>(() =>
    draftFromCycle({ kind: "months", every: 1 }, newSuggestedFrom),
  );
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const editing = mode?.kind === "edit" ? mode.row : null;
  const members = new Set(editing?.memberIds ?? []);
  const floor = editing?.floor ?? null;
  const cycleProblem = changeCycle ? draftError(draft, floor) : null;
  const offsetN = Number(offset);
  const offsetOk = Number.isInteger(offsetN) && offsetN >= 0 && offsetN <= 31;
  const canSave =
    !busy && name.trim().length > 0 && offsetOk && cycleProblem === null;

  function openNew() {
    setName("");
    setDescription("");
    setOffset("0");
    setMakeDefault(false);
    setChangeCycle(true);
    setDraft(draftFromCycle({ kind: "months", every: 1 }, newSuggestedFrom));
    setPicked(new Set());
    setMode({ kind: "new" });
  }

  function openEdit(row: ScheduleRow) {
    setName(row.name);
    setDescription(row.description ?? "");
    setOffset(String(row.paydayOffsetDays));
    setMakeDefault(false);
    setChangeCycle(false);
    setDraft(draftFromCycle(row.cycle, row.suggestedFrom));
    setPicked(new Set());
    setMode({ kind: "edit", row });
  }

  async function send(
    url: string,
    method: string,
    body?: Record<string, unknown>,
  ): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const code = (json as { error?: { code?: string } } | null)?.error
          ?.code;
        toast.error(
          (code && MESSAGES[code]) ??
            formatApiError(json, "Could not save the schedule."),
        );
        return false;
      }
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!mode) return;
    const moving = [...picked].filter((id) => !members.has(id));
    const ok =
      mode.kind === "new"
        ? await send("/api/admin/company/hr/pay-schedules", "POST", {
            name: name.trim(),
            description: description.trim(),
            change: { from: draft.from, cycle: cycleOf(draft) },
            paydayOffsetDays: offsetN,
            isDefault: makeDefault,
            employeeIds: moving,
          })
        : await send(
            `/api/admin/company/hr/pay-schedules/${mode.row.ref}`,
            "PATCH",
            {
              name: name.trim(),
              description: description.trim(),
              paydayOffsetDays: offsetN,
              ...(makeDefault ? { isDefault: true } : {}),
              ...(changeCycle
                ? { change: { from: draft.from, cycle: cycleOf(draft) } }
                : {}),
              ...(moving.length ? { employeeIds: moving } : {}),
            },
          );
    if (!ok) return;
    toast.success(mode.kind === "new" ? "Schedule added." : "Schedule saved.");
    setMode(null);
    router.refresh();
  }

  async function archive(row: ScheduleRow) {
    const ok = await send(
      `/api/admin/company/hr/pay-schedules/${row.ref}`,
      "DELETE",
    );
    if (!ok) return;
    toast.success("Schedule archived.");
    setMode(null);
    router.refresh();
  }

  const columns: Column<ScheduleRow>[] = [
    {
      key: "name",
      header: "Schedule",
      mobile: "primary",
      cell: (r) => (
        <span>
          <span className="font-medium">{r.name}</span>
          {r.isDefault && (
            <StatusBadge tone="brand" className="ml-2">
              Default
            </StatusBadge>
          )}
          {r.description && (
            <span className="text-muted-foreground block text-xs">
              {r.description}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "cycle",
      header: "Pays",
      mobile: "meta",
      cell: (r) => (
        <span>
          {r.cycleLabel}
          {r.planned && (
            <span className="text-muted-foreground block text-xs">
              {r.planned}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "period",
      header: "This period",
      mobile: "meta",
      cell: (r) => (
        <span>
          {r.currentPeriod}
          <span className="text-muted-foreground block text-xs">
            Payday {r.payday}
          </span>
        </span>
      ),
    },
    {
      key: "people",
      header: "People",
      align: "right",
      mobile: "meta",
      cell: (r) => <span className="tabular-nums">{r.people}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      mobile: "actions",
      cell: (r) => (
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5"
          onClick={() => openEdit(r)}
          aria-label={`Edit ${r.name}`}
        >
          <Pencil className="size-4" />
          Edit
        </Button>
      ),
    },
  ];

  return (
    <>
      <SectionCard
        title="Pay schedules"
        description="When each group is paid. A payout pays everything someone has earned and not yet been paid."
        action={
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="size-4" />
            New schedule
          </Button>
        }
        bodyClassName="p-0"
      >
        <DataTable
          columns={columns}
          rows={schedules}
          getRowKey={(r) => r.ref}
          empty="No schedules yet."
          minWidth={640}
          className="rounded-none border-0"
        />
      </SectionCard>

      <Dialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mode?.kind === "edit"
                ? `Edit ${mode.row.name}`
                : "New pay schedule"}
            </DialogTitle>
            <DialogDescription>
              How often the people on it are paid. How much a director&apos;s
              share is worth is set by the profit split on the Payroll page,
              never here.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="schedule-name">Name</Label>
                <Input
                  id="schedule-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  placeholder="Directors"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="schedule-payday">
                  Payday, days after a period ends
                </Label>
                <Input
                  id="schedule-payday"
                  value={offset}
                  onChange={(e) => setOffset(e.target.value)}
                  inputMode="numeric"
                  aria-describedby="schedule-payday-hint"
                />
                <p
                  id="schedule-payday-hint"
                  className={
                    offsetOk
                      ? "text-muted-foreground text-xs"
                      : "text-destructive text-xs"
                  }
                >
                  0 is the day after the period&apos;s last day (0–31).
                </p>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="schedule-description">Note (optional)</Label>
              <Input
                id="schedule-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={300}
              />
            </div>

            {editing && (
              <Label className="flex items-center gap-2 font-normal">
                <Checkbox
                  checked={changeCycle}
                  onCheckedChange={(c) => setChangeCycle(c === true)}
                />
                Change how often it pays (now:{" "}
                {editing.cycleLabel.toLowerCase()})
              </Label>
            )}
            {changeCycle && (
              <CycleEditor
                value={draft}
                onChange={setDraft}
                minFrom={floor}
                idPrefix="schedule-cycle"
              />
            )}

            {!(editing?.isDefault ?? false) && (
              <Label className="flex items-center gap-2 font-normal">
                <Checkbox
                  checked={makeDefault}
                  onCheckedChange={(c) => setMakeDefault(c === true)}
                />
                Make it the default — new people are paid on it
              </Label>
            )}

            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">People on it</legend>
              <p className="text-muted-foreground text-xs">
                Tick someone to move them onto this schedule. To take someone
                off, put them on another schedule.
              </p>
              <div className="grid max-h-56 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-2">
                {people.length === 0 && (
                  <p className="text-muted-foreground text-sm">
                    Nobody on the payroll yet.
                  </p>
                )}
                {people.map((p) => {
                  const member = members.has(p.id);
                  return (
                    <Label
                      key={p.id}
                      className="flex items-start gap-2 rounded px-1 py-1 font-normal"
                    >
                      <Checkbox
                        checked={member || picked.has(p.id)}
                        disabled={member}
                        onCheckedChange={(c) =>
                          setPicked((prev) => {
                            const next = new Set(prev);
                            if (c === true) next.add(p.id);
                            else next.delete(p.id);
                            return next;
                          })
                        }
                      />
                      <span className="min-w-0">
                        <span className="block">{p.name}</span>
                        <span className="text-muted-foreground block text-xs">
                          {member
                            ? "On this schedule"
                            : `Now: ${p.scheduleName}`}
                        </span>
                      </span>
                    </Label>
                  );
                })}
              </div>
            </fieldset>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {editing && !editing.isDefault && !editing.virtual && (
                <Button
                  variant="ghost"
                  className="text-destructive gap-1.5"
                  disabled={busy || editing.people > 0}
                  title={
                    editing.people > 0
                      ? "Move everyone onto another schedule first"
                      : undefined
                  }
                  onClick={() => archive(editing)}
                >
                  <Archive className="size-4" />
                  Archive
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode(null)}>
                Cancel
              </Button>
              <Button disabled={!canSave} onClick={save}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {mode?.kind === "edit" ? "Save" : "Add schedule"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
