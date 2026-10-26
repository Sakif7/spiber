"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/admin/ui/select-field";
import {
  canStartOn,
  CYCLE_LIMITS,
  cycleError,
  formatDay,
  nextPeriod,
  nextStartOn,
  periodAt,
  periodLabel,
  type Cycle,
  type CycleKind,
  type CycleVersion,
} from "@/lib/hr/cycles";

/**
 * Picking a cycle: how often, and from which day. The same control sets the
 * profit split and every pay schedule, so the two can never be described in
 * different words.
 *
 * Kept as strings while typed, so a half-typed number does not snap back.
 */
export type CycleDraft = { kind: CycleKind; n: string; from: string };

const KIND_OPTIONS: { value: CycleKind; label: string }[] = [
  { value: "months", label: "Every N months" },
  { value: "semi_monthly", label: "Twice a month" },
  { value: "weeks", label: "Every N weeks" },
  { value: "days", label: "Every N days" },
];

const N_LABEL: Record<CycleKind, string> = {
  months: "Months",
  semi_monthly: "Second half starts on day",
  weeks: "Weeks",
  days: "Days",
};

const N_DEFAULT: Record<CycleKind, string> = {
  months: "1",
  semi_monthly: "16",
  weeks: "2",
  days: "10",
};

export function draftFromCycle(cycle: Cycle, from: string): CycleDraft {
  return {
    kind: cycle.kind,
    n: String(cycle.kind === "semi_monthly" ? cycle.splitDay : cycle.every),
    from,
  };
}

export function cycleOf(draft: CycleDraft): Cycle {
  const n = Number(draft.n);
  return draft.kind === "semi_monthly"
    ? { kind: "semi_monthly", splitDay: n }
    : { kind: draft.kind, every: n };
}

/** What is wrong with a draft, in words, or null when it can be saved. */
export function draftError(
  draft: CycleDraft,
  minFrom?: string | null,
): string | null {
  const cycle = cycleOf(draft);
  const bad = cycleError(cycle);
  if (bad) return bad;
  if (!draft.from) return "Pick the day it starts.";
  if (!canStartOn(cycle, draft.from)) {
    return cycle.kind === "months"
      ? "A cycle of months starts on the 1st of a month."
      : "Twice a month starts on the 1st or on the day the second half starts.";
  }
  if (minFrom && draft.from < minFrom) {
    return `It can start on ${formatDay(minFrom)} at the earliest — the periods before that are already on record.`;
  }
  return null;
}

/** The first few periods a draft would make, for the preview line. */
function preview(draft: CycleDraft): string[] {
  const cycle = cycleOf(draft);
  if (cycleError(cycle) || !canStartOn(cycle, draft.from)) return [];
  const versions: CycleVersion[] = [{ from: draft.from, cycle }];
  const out: string[] = [];
  let p = periodAt(versions, draft.from);
  for (let i = 0; i < 3; i++) {
    out.push(periodLabel(p.start, p.end));
    p = nextPeriod(versions, p);
  }
  return out;
}

export function CycleEditor({
  value,
  onChange,
  minFrom,
  idPrefix,
}: {
  value: CycleDraft;
  onChange: (next: CycleDraft) => void;
  /** The earliest day it may start; earlier periods are on record. */
  minFrom?: string | null;
  idPrefix: string;
}) {
  const { min, max } = CYCLE_LIMITS[value.kind];
  const periods = preview(value);
  const error = draftError(value, minFrom);

  function setKind(kind: CycleKind) {
    const n = N_DEFAULT[kind];
    const cycle = cycleOf({ kind, n, from: value.from });
    // Snap the start to the first day this kind of cycle may begin on.
    const from = value.from ? nextStartOn(cycle, value.from) : value.from;
    onChange({ kind, n, from });
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-kind`}>Repeats</Label>
          <SelectField
            id={`${idPrefix}-kind`}
            value={value.kind}
            onChange={(k) => setKind(k as CycleKind)}
            options={KIND_OPTIONS}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-n`}>{N_LABEL[value.kind]}</Label>
          <Input
            id={`${idPrefix}-n`}
            value={value.n}
            onChange={(e) => onChange({ ...value, n: e.target.value })}
            inputMode="numeric"
            aria-describedby={`${idPrefix}-n-hint`}
          />
          <p
            id={`${idPrefix}-n-hint`}
            className="text-muted-foreground text-xs"
          >
            {value.kind === "semi_monthly"
              ? `1st up to the day before, then that day to the end of the month (${min}–${max}).`
              : `Between ${min} and ${max}.`}
          </p>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-from`}>Starts on</Label>
        <Input
          id={`${idPrefix}-from`}
          type="date"
          value={value.from}
          min={minFrom ?? undefined}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          className="sm:max-w-56"
        />
        <p className="text-muted-foreground text-xs">
          Periods before this day keep the cycle they had.
        </p>
      </div>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : (
        periods.length > 0 && (
          <p className="text-muted-foreground text-sm">
            First periods:{" "}
            <span className="text-foreground">{periods.join(" · ")}</span>
          </p>
        )
      )}
    </div>
  );
}
