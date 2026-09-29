"use client";

import { useRef, useState } from "react";
import { useAfterSave } from "@/components/admin/ui/form-panel";
import { toast } from "sonner";
import { Paperclip, Loader2, Plus, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  EditorForm,
  FormSection,
  FormGrid,
  FormField,
  SaveBar,
} from "@/components/admin/ui/form-shell";
import { SelectField } from "@/components/admin/ui/select-field";
import { formatApiError } from "@/lib/http/form-error";
import { formatBDT } from "@/lib/money";
import { cn } from "@/lib/cn";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
} from "@/lib/hr/expense-constants";
import {
  MAX_EXPENSE_LINES,
  MAX_EXPENSE_RECEIPTS,
} from "@/lib/hr/expense-lines";
import type { PersonOption } from "./visit-form";

export type VisitOption = { id: string; label: string };

/** One line of the bill as typed. Taka as text, converted to poisha on save. */
export type ExpenseLineValues = {
  /** Stable React key, so removing a line never shifts the inputs below. */
  key: string;
  spentAt: string;
  category: string;
  description: string;
  amount: string;
};

export type ExpenseFormValues = {
  id?: string;
  visitId: string;
  employeeId: string;
  /** What the bill was for. */
  description: string;
  lines: ExpenseLineValues[];
  receipts: { id: string; title: string }[];
};

/** Today in Dhaka — a claim's days are Dhaka days, not UTC ones. */
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });

const minorOf = (amount: string) => {
  const taka = Number(amount);
  return Number.isFinite(taka) && taka > 0 ? Math.round(taka * 100) : 0;
};

/** The columns a line takes once the form is wide enough to be a table. */
const LINE_GRID =
  "@2xl:grid-cols-[2rem_9.5rem_9.5rem_minmax(0,1fr)_8rem_2.25rem] @2xl:gap-x-2";

/** One field of a line, captioned only while the line is a card. */
function LineField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid min-w-0 content-start gap-1", className)}>
      {/* The control carries its own full name ("Date of line 2"); this
          caption is only what a sighted reader needs on a narrow card. */}
      <span
        aria-hidden
        className="text-muted-foreground text-admin-2xs @2xl:hidden"
      >
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * Record or edit a claim — a bill of lines, each a cost on its own day, the
 * way a conveyance or TA bill is written. The total is the sum of the lines
 * and is worked out again on the server; approving and paying back happen
 * to the bill as a whole.
 */
export function ExpenseForm({
  expense,
  people,
  visits,
  lockedVisitId,
  endpoint = "/api/admin/company/people/expenses",
  receiptEndpoint = "/api/admin/company/people/expenses/receipt",
  afterHref = "/admin/company/people/expenses",
}: {
  expense?: ExpenseFormValues;
  people: PersonOption[];
  visits: VisitOption[];
  /** Set when adding a claim from a visit's page. */
  lockedVisitId?: string;
  /** The employee portal posts to its own scoped routes. With exactly one
   *  person in `people` the "Paid by" choice is fixed to them. */
  endpoint?: string;
  receiptEndpoint?: string;
  afterHref?: string;
}) {
  const afterSave = useAfterSave();
  const [v, setV] = useState<ExpenseFormValues>(
    expense ?? {
      visitId: lockedVisitId ?? "",
      employeeId: people[0]?.id ?? "",
      description: "",
      lines: [
        {
          key: "0",
          spentAt: today(),
          category: "meal",
          description: "",
          amount: "",
        },
      ],
      receipts: [],
    },
  );
  const [nextKey, setNextKey] = useState(1000);
  // Row problems are shown once a save has been tried, not while a fresh
  // line is still being filled in.
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ExpenseFormValues>(
    k: K,
    value: ExpenseFormValues[K],
  ) => setV((prev) => ({ ...prev, [k]: value }));

  const setLine = (i: number, patch: Partial<ExpenseLineValues>) =>
    setV((prev) => ({
      ...prev,
      lines: prev.lines.map((l, n) => (n === i ? { ...l, ...patch } : l)),
    }));

  /** A new line starts on the day and heading of the one above it. */
  function addLine() {
    setV((prev) => {
      const last = prev.lines[prev.lines.length - 1];
      return {
        ...prev,
        lines: [
          ...prev.lines,
          {
            key: String(nextKey),
            spentAt: last?.spentAt || today(),
            category: last?.category ?? "meal",
            description: "",
            amount: "",
          },
        ],
      };
    });
    setNextKey((k) => k + 1);
  }

  const removeLine = (i: number) =>
    setV((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, n) => n !== i),
    }));

  const total = v.lines.reduce((sum, l) => sum + minorOf(l.amount), 0);
  const firstDay =
    v.lines
      .map((l) => l.spentAt)
      .filter(Boolean)
      .sort()[0] ?? today();
  const lineIssue = (l: ExpenseLineValues) => ({
    date: !l.spentAt,
    amount: minorOf(l.amount) === 0,
  });

  async function uploadReceipts(picked: File[]) {
    const room = MAX_EXPENSE_RECEIPTS - v.receipts.length;
    if (picked.length > room) {
      toast.error(
        `A bill takes at most ${MAX_EXPENSE_RECEIPTS} receipts — ${room} more can be added.`,
      );
    }
    const files = picked.slice(0, Math.max(0, room));
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        const body = new FormData();
        body.set("file", file);
        // Filed under the month the bill starts in.
        body.set("spentAt", firstDay);
        const res = await fetch(receiptEndpoint, { method: "POST", body });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          setError(
            formatApiError(json, `Could not file ${file.name || "a receipt"}.`),
          );
          return;
        }
        const filed = {
          id: String(json?.data?.documentId ?? ""),
          title: String(json?.data?.title ?? file.name),
        };
        setV((prev) => ({ ...prev, receipts: [...prev.receipts, filed] }));
      }
      toast.success(
        files.length === 1
          ? "Receipt filed in the vault."
          : `${files.length} receipts filed in the vault.`,
      );
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    setTried(true);
    if (!v.description.trim()) {
      setError("Say what the bill was for.");
      return;
    }
    const bad = v.lines.findIndex((l) => {
      const issue = lineIssue(l);
      return issue.date || issue.amount;
    });
    if (bad >= 0) {
      const issue = lineIssue(v.lines[bad]);
      setError(
        `Line ${bad + 1} needs ${issue.date ? "a date" : "an amount greater than zero"}.`,
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        visitId: v.visitId || null,
        employeeId: v.employeeId,
        description: v.description,
        lines: v.lines.map((l) => ({
          spentAt: l.spentAt,
          category: l.category,
          description: l.description.trim() || undefined,
          amountMinor: minorOf(l.amount),
        })),
        receiptDocumentIds: v.receipts.map((r) => r.id),
      };
      const res = await fetch(
        expense?.id ? `${endpoint}/${expense.id}` : endpoint,
        {
          method: expense?.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(formatApiError(json, "Could not save the claim."));
        return;
      }
      toast.success(expense?.id ? "Claim updated." : "Claim recorded.");
      afterSave(`${afterHref}/${expense?.id ?? json?.data?.id ?? ""}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditorForm>
      <FormSection
        title="The bill"
        description="Whoever paid is who gets it back. Linking the visit shows why the money was spent."
      >
        <FormGrid cols={2}>
          <FormField label="Paid by" required>
            <SelectField
              value={v.employeeId}
              onChange={(value) => set("employeeId", value)}
              placeholder="Choose a person"
              options={people.map((p) => ({ value: p.id, label: p.name }))}
              disabled={people.length === 1}
            />
          </FormField>
          <FormField label="Visit">
            <SelectField
              value={v.visitId}
              onChange={(value) => set("visitId", value)}
              emptyLabel="— not on a visit —"
              disabled={Boolean(lockedVisitId)}
              options={visits.map((t) => ({ value: t.id, label: t.label }))}
            />
          </FormField>
        </FormGrid>
        <FormField label="What it was for" required>
          <Input
            value={v.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Chattogram hospital visit"
            maxLength={300}
            aria-invalid={tried && !v.description.trim()}
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Lines"
        description="One line for each cost on the bill. Amounts are in taka."
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={addLine}
            disabled={v.lines.length >= MAX_EXPENSE_LINES}
          >
            <Plus className="size-4" />
            Add line
          </Button>
        }
      >
        {/* One markup, two shapes: a row of a table when the form is wide,
            a small card per line when it is narrow — the portal on a phone
            — so nobody scrolls sideways to reach the amount. The breakpoint
            is the form's own width (a container query), not the screen's:
            this form lives in a side panel. On the card the fields are
            re-ordered (`order-*`) so the date gets a full row; the table
            keeps the source order. */}
        <div className="@container">
          <div className="grid gap-3 @2xl:gap-0">
            <div
              className={cn(
                LINE_GRID,
                // Bold like the order editor's <th> cells, which this
                // header stands in for; the size of this form's labels.
                "text-muted-foreground hidden border-b py-2 text-sm font-bold @2xl:grid",
              )}
            >
              <span>#</span>
              <span>Date</span>
              <span>Category</span>
              <span>Note</span>
              {/* pr-3 = the input's own 12px of padding, so the heading
                  sits over its figures. */}
              <span className="pr-3 text-right">Amount</span>
              <span />
            </div>
            {v.lines.map((l, i) => {
              const issue = tried
                ? lineIssue(l)
                : { date: false, amount: false };
              return (
                <div
                  key={l.key}
                  className={cn(
                    LINE_GRID,
                    "grid grid-cols-2 gap-2 rounded-md border p-3",
                    "@2xl:items-start @2xl:rounded-none @2xl:border-0 @2xl:border-b @2xl:px-0 @2xl:py-1.5",
                  )}
                >
                  <span className="text-muted-foreground order-1 self-center text-xs font-medium @2xl:order-none @2xl:self-start @2xl:pt-2 @2xl:text-sm @2xl:font-normal">
                    <span className="@2xl:hidden">Line </span>
                    {i + 1}
                  </span>
                  <LineField
                    label="Date"
                    className="order-3 col-span-2 @2xl:order-none @2xl:col-span-1"
                  >
                    <Input
                      type="date"
                      value={l.spentAt}
                      onChange={(e) => setLine(i, { spentAt: e.target.value })}
                      aria-label={`Date of line ${i + 1}`}
                      aria-invalid={issue.date}
                      className={cn(issue.date && "border-destructive")}
                    />
                  </LineField>
                  <LineField
                    label="Category"
                    className="order-4 @2xl:order-none"
                  >
                    <SelectField
                      value={l.category}
                      onChange={(value) => setLine(i, { category: value })}
                      ariaLabel={`Category of line ${i + 1}`}
                      className="min-w-0"
                      options={EXPENSE_CATEGORIES.map((c) => ({
                        value: c,
                        label: EXPENSE_CATEGORY_LABEL[c] ?? c,
                      }))}
                    />
                  </LineField>
                  <LineField
                    label="Note"
                    className="order-6 col-span-2 @2xl:order-none @2xl:col-span-1"
                  >
                    <Input
                      value={l.description}
                      onChange={(e) =>
                        setLine(i, { description: e.target.value })
                      }
                      aria-label={`Note for line ${i + 1}`}
                      placeholder={
                        i === 0 ? "Lunch with the procurement lead" : ""
                      }
                      maxLength={300}
                    />
                  </LineField>
                  <LineField
                    label="Amount (৳)"
                    className="order-5 @2xl:order-none"
                  >
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={l.amount}
                      onChange={(e) => setLine(i, { amount: e.target.value })}
                      aria-label={`Amount of line ${i + 1}, in taka`}
                      aria-invalid={issue.amount}
                      // Only the first line shows an example: a grey
                      // figure in an empty line below reads as a value.
                      placeholder={i === 0 ? "850" : ""}
                      className={cn(
                        "text-right",
                        issue.amount && "border-destructive",
                      )}
                    />
                    {issue.amount && (
                      <span className="text-destructive text-admin-2xs block">
                        Needs an amount
                      </span>
                    )}
                  </LineField>
                  <div className="order-2 flex items-center justify-end @2xl:order-none @2xl:items-start">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-destructive size-9"
                      aria-label={`Remove line ${i + 1}`}
                      // A bill always has at least one line.
                      disabled={v.lines.length === 1}
                      onClick={() => removeLine(i)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            <div
              className={cn(
                LINE_GRID,
                "flex items-center justify-between px-1 @2xl:grid @2xl:px-0 @2xl:py-2.5",
              )}
            >
              <span className="font-medium @2xl:col-span-4 @2xl:text-right">
                Total
              </span>
              <span className="font-semibold tabular-nums @2xl:pr-3 @2xl:text-right">
                {formatBDT(total, "en")}
              </span>
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Receipts"
        description="The bill and any receipts behind it, filed encrypted in the company vault under HR / Expenses."
      >
        {v.receipts.length > 0 && (
          <ul className="grid gap-2">
            {v.receipts.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <span className="bg-muted inline-flex min-w-0 items-center gap-1.5 rounded-md px-2.5 py-1.5">
                  <Paperclip className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{r.title || "Receipt"}</span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove ${r.title || "receipt"}`}
                  onClick={() =>
                    set(
                      "receipts",
                      v.receipts.filter((x) => x.id !== r.id),
                    )
                  }
                >
                  <X className="size-4" aria-hidden />
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
        {v.receipts.length < MAX_EXPENSE_RECEIPTS && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              multiple
              className="sr-only"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) void uploadReceipts(files);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Paperclip className="size-4" aria-hidden />
              )}
              {uploading
                ? "Filing…"
                : v.receipts.length
                  ? "Attach another"
                  : "Attach receipts"}
            </Button>
            <span className="text-muted-foreground text-admin-xs">
              JPEG, PNG, WebP or PDF, up to 10MB each.
            </span>
          </div>
        )}
      </FormSection>

      <SaveBar
        onSave={save}
        saving={saving}
        error={error}
        disabled={uploading}
        saveLabel={expense?.id ? "Save changes" : "Record claim"}
      />
    </EditorForm>
  );
}
