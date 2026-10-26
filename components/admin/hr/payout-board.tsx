"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Banknote, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { SectionCard } from "@/components/admin/ui/section-card";
import { SelectField } from "@/components/admin/ui/select-field";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { calloutClass } from "@/components/admin/ui/tone";
import { formatApiError } from "@/lib/http/form-error";
import { formatBDT } from "@/lib/money";

export type BoardItem = { kind: string; label: string; amount: string };

export type BoardRowView = {
  employeeId: string;
  name: string;
  designation: string;
  active: boolean;
  items: BoardItem[];
  total: string;
  totalMinor: number;
  notes: string[];
  paid: {
    id: string;
    ref: string;
    total: string;
    on: string;
    method: string;
    reference: string | null;
  }[];
  bank: {
    bankName: string | null;
    accountName: string | null;
    accountNumber: string;
  } | null;
};

export type BoardView = {
  /** The schedule as the API names it. */
  schedule: string;
  scheduleName: string;
  periodKey: string;
  periodLabel: string;
  state: "upcoming" | "running" | "ended";
  /** "30 Nov 2026" — the period's last day. */
  lastDay: string;
  payday: string;
  /** Today, as the date input wants it. */
  today: string;
  rows: BoardRowView[];
};

const KIND_LABEL: Record<string, string> = {
  share: "Share",
  run_salary: "Salary",
  salary: "Salary",
  claims: "Claims",
  run_reimbursement: "Claims",
};

const METHODS = [
  { value: "bank", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "mobile", label: "Mobile wallet" },
  { value: "other", label: "Other" },
];

const MESSAGES: Record<string, string> = {
  nothing_due: "nothing is due",
  changed:
    "something in it was paid or changed while it was being recorded — nothing was paid; refresh and try again",
  not_on_schedule: "they are no longer on this schedule",
};

/**
 * One pay period of one schedule: what each person is owed and the button
 * that records paying them.
 *
 * Amounts shown here are a preview. The server works the payout out again
 * when it is recorded, so a claim approved a second ago is included and a
 * line someone else just paid is not paid twice.
 */
export function PayoutBoard({ board }: { board: BoardView }) {
  const router = useRouter();
  const [paying, setPaying] = useState<BoardRowView[] | null>(null);
  const [method, setMethod] = useState("bank");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(board.today);
  const [busy, setBusy] = useState(false);

  const due = board.rows.filter((r) => r.totalMinor > 0);
  const early = board.state === "running";

  function open(rows: BoardRowView[]) {
    setMethod("bank");
    setReference("");
    setPaidOn(board.today);
    setPaying(rows);
  }

  async function pay() {
    if (!paying) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/company/hr/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedule: board.schedule,
          periodKey: board.periodKey,
          employeeIds: paying.map((r) => r.employeeId),
          method,
          reference,
          paidOn,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: {
          outcomes: {
            employeeId: string;
            name: string;
            ok: boolean;
            code?: string;
          }[];
        };
      } | null;
      if (!res.ok || !json?.data) {
        toast.error(formatApiError(json, "The payout was not recorded."));
        return;
      }
      const outcomes = json.data.outcomes;
      const paid = outcomes.filter((o) => o.ok);
      const failed = outcomes.filter((o) => !o.ok);
      if (paid.length) {
        toast.success(
          paid.length === 1
            ? `Paid ${paid[0]!.name}.`
            : `Paid ${paid.length} people.`,
        );
      }
      for (const f of failed) {
        toast.error(
          `${f.name || "Someone"}: ${MESSAGES[f.code ?? ""] ?? "not paid"}.`,
        );
      }
      setPaying(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<BoardRowView>[] = [
    {
      key: "name",
      header: "Person",
      mobile: "primary",
      cell: (r) => (
        <span>
          <Link
            href={`/admin/company/people/employees/${r.employeeId}`}
            className="text-primary font-medium hover:underline"
          >
            {r.name}
          </Link>
          <span className="text-muted-foreground block text-xs">
            {r.designation}
            {!r.active && " · not on this schedule now"}
          </span>
        </span>
      ),
    },
    {
      key: "items",
      header: "In it",
      mobile: "meta",
      cell: (r) =>
        r.items.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <ul className="grid gap-0.5 text-xs">
            {r.items.map((i, n) => (
              <li key={n} className="flex justify-between gap-3">
                <span>
                  <span className="text-muted-foreground">
                    {KIND_LABEL[i.kind] ?? i.kind}
                  </span>{" "}
                  {i.label}
                </span>
                <span className="tabular-nums">{i.amount}</span>
              </li>
            ))}
          </ul>
        ),
    },
    {
      key: "due",
      header: early ? "So far" : "Due",
      align: "right",
      mobile: "meta",
      cell: (r) => (
        <span className="font-medium tabular-nums">
          {r.totalMinor > 0 ? r.total : "—"}
        </span>
      ),
    },
    {
      key: "paid",
      header: "Paid",
      mobile: "meta",
      cell: (r) =>
        r.paid.length ? (
          <span className="grid gap-0.5">
            {r.paid.map((p) => (
              <span key={p.id} className="text-xs">
                <StatusBadge tone="success">Paid</StatusBadge>{" "}
                <Link
                  href={`/admin/company/people/payouts/${p.id}`}
                  className="text-primary hover:underline"
                >
                  {p.total}
                </Link>{" "}
                <span className="text-muted-foreground">{p.on}</span>
              </span>
            ))}
          </span>
        ) : r.totalMinor > 0 ? (
          <StatusBadge tone={early ? "info" : "warning"}>
            {early ? "Accruing" : "Due"}
          </StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Nothing due</StatusBadge>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      mobile: "actions",
      cell: (r) =>
        r.totalMinor > 0 && board.state !== "upcoming" ? (
          <Button
            size="sm"
            variant={early ? "outline" : "default"}
            onClick={() => open([r])}
          >
            {early ? "Pay early" : r.paid.length ? "Pay the rest" : "Pay"}
          </Button>
        ) : null,
    },
  ];

  const total = paying?.reduce((n, r) => n + r.totalMinor, 0) ?? 0;

  return (
    <>
      <SectionCard
        title={`${board.scheduleName} · ${board.periodLabel}`}
        description={
          board.state === "upcoming"
            ? "This period has not started yet."
            : early
              ? `Running until ${board.lastDay}. Paying now pays what has been earned up to today; the rest follows with the next payout for this period.`
              : `Ended ${board.lastDay} · payday ${board.payday}.`
        }
        action={
          due.length > 1 && !early ? (
            <Button size="sm" className="gap-1.5" onClick={() => open(due)}>
              <Banknote className="size-4" />
              Pay all due ({due.length})
            </Button>
          ) : undefined
        }
      >
        <DataTable
          columns={columns}
          rows={board.rows}
          getRowKey={(r) => r.employeeId}
          empty="Nobody is on this schedule."
          minWidth={760}
        />
      </SectionCard>

      <Dialog
        open={paying !== null}
        onOpenChange={(o) => !o && setPaying(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {paying?.length === 1
                ? `Pay ${paying[0]!.name}`
                : `Pay ${paying?.length ?? 0} people`}
            </DialogTitle>
            <DialogDescription>
              Record the money once it has gone. What each payout holds is
              worked out again when you record it.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {paying?.map((r) => (
              <div key={r.employeeId} className="grid gap-1.5 text-sm">
                {(paying.length > 1 || r.items.length > 0) && (
                  <div className="flex items-baseline justify-between gap-3 font-medium">
                    <span>{r.name}</span>
                    <span className="tabular-nums">{r.total}</span>
                  </div>
                )}
                {paying.length === 1 &&
                  r.items.map((i, n) => (
                    <div
                      key={n}
                      className="text-muted-foreground flex justify-between gap-3 pl-3 text-xs"
                    >
                      <span>
                        {KIND_LABEL[i.kind] ?? i.kind} · {i.label}
                      </span>
                      <span className="tabular-nums">{i.amount}</span>
                    </div>
                  ))}
                {paying.length === 1 && r.bank && (
                  <p className="text-muted-foreground text-xs">
                    To {r.bank.accountName ?? r.name} ·{" "}
                    {r.bank.bankName ?? "bank"} ·{" "}
                    <span className="font-mono">{r.bank.accountNumber}</span>
                  </p>
                )}
                {paying.length === 1 && r.notes.length > 0 && (
                  <div
                    className={calloutClass("warning", "grid gap-1 text-xs")}
                  >
                    {r.notes.map((note) => (
                      <p key={note}>{note}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {paying && paying.length > 1 && (
              <div className="flex justify-between border-t pt-2 text-sm font-medium">
                <span>Total</span>
                <span className="tabular-nums">{formatBDT(total, "en")}</span>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="payout-method">How it was paid</Label>
                <SelectField
                  id="payout-method"
                  value={method}
                  onChange={setMethod}
                  options={METHODS}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="payout-date">Paid on</Label>
                <Input
                  id="payout-date"
                  type="date"
                  value={paidOn}
                  max={board.today}
                  onChange={(e) => setPaidOn(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="payout-reference">Reference</Label>
              <Input
                id="payout-reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Transfer or cheque number"
                maxLength={120}
              />
              {paying && paying.length > 1 && (
                <p className="text-muted-foreground text-xs">
                  The same reference goes on every payout — a bulk transfer
                  batch, say. Pay people one at a time to give each their own.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaying(null)}>
              Cancel
            </Button>
            <Button disabled={busy || !paidOn} onClick={pay}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Record payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
