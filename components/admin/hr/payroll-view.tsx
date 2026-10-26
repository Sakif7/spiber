"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, FileText, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { StatCard } from "@/components/admin/ui/stat-card";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { SectionCard } from "@/components/admin/ui/section-card";
import { formatApiError } from "@/lib/http/form-error";
import { Banknote, Globe, Handshake, PieChart, Wallet } from "lucide-react";

export type PayrollLineRow = {
  employeeId: string;
  name: string;
  designation: string;
  /** "2,000 of 14,000 shares", "fixed", or "20%" on a legacy month. */
  rateLabel: string;
  amount: string;
  /** A line of ৳0 has nothing to hand over. */
  nothingToPay: boolean;
  /** How it was paid, once it has been. */
  paid: {
    on: string;
    /** The payout that paid it; null for one marked paid before payouts. */
    payoutId: string | null;
    reference: string | null;
  } | null;
};

/**
 * How the period's pool was arrived at, every figure already formatted.
 *
 * Null on a month approved under the percentage scheme, which had no pool;
 * the view then falls back to the revenue cards that month was computed from.
 */
export type PayrollPoolView = {
  grossProfit: string;
  orderCosts: string;
  expenses: string;
  ait: string;
  netCash: string;
  salaries: string;
  /** Who the salaries were, when the period recorded it. */
  salaryLines: { name: string; amount: string }[];
  distributable: string;
  totalShares: number;
  allocatedShares: number;
  /** True when the period came out at or below zero after salaries. */
  nothingToSplit: boolean;
};

export type ReimbursementRow = {
  employeeId: string;
  name: string;
  amount: string;
  claims: number;
  paid: boolean;
};

export type PayrollViewData = {
  /** The profit period's key. */
  key: string;
  label: string;
  status: "draft" | "approved";
  /** True while the period is still running. */
  running: boolean;
  revenue: { total: string; online: string; manual: string };
  pool: PayrollPoolView | null;
  /** Shares (and, on a month from before payouts, salaries) alone. */
  total: string;
  /** Only on a month from before payouts, which froze its claims. */
  reimbursements: ReimbursementRow[];
  reimbursementTotal: string;
  grandTotal: string;
  lines: PayrollLineRow[];
  approvedAt: string | null;
};

/**
 * One profit period's payroll.
 *
 * A draft recomputes every time it is opened, because money for the period
 * is still arriving; approving it freezes the figures. That distinction is
 * the point of the screen, so it is stated rather than implied. Paying is
 * not done here: each person's payout, on their own pay schedule, takes the
 * lines of approved periods.
 */
export function PayrollView({ data }: { data: PayrollViewData }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reason, setReason] = useState("");

  async function call(
    path: string,
    body: Record<string, unknown>,
    okMessage: string,
  ) {
    setBusy(true);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const code = (json as { error?: { code?: string } } | null)?.error
          ?.code;
        toast.error(
          code === "has_paid_lines"
            ? "Someone has already been paid from this period, so it cannot be reopened."
            : formatApiError(json, "That didn't work."),
        );
        return false;
      }
      toast.success(okMessage);
      setReopening(false);
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<PayrollLineRow>[] = [
    {
      key: "name",
      header: "Director",
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
          </span>
        </span>
      ),
    },
    {
      key: "rate",
      header: "Holding",
      mobile: "meta",
      cell: (r) => <span className="font-mono text-xs">{r.rateLabel}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      mobile: "meta",
      cell: (r) => <span className="font-medium">{r.amount}</span>,
    },
    {
      key: "paid",
      header: "Paid",
      mobile: "meta",
      cell: (r) =>
        r.paid ? (
          <span>
            <StatusBadge tone="success">Paid</StatusBadge>
            <span className="text-muted-foreground block text-xs">
              {r.paid.on}
              {r.paid.payoutId ? (
                <>
                  {" · "}
                  <Link
                    href={`/admin/company/people/payouts/${r.paid.payoutId}`}
                    className="text-primary hover:underline"
                  >
                    {r.paid.reference}
                  </Link>
                </>
              ) : r.paid.reference ? (
                ` · ${r.paid.reference}`
              ) : null}
            </span>
          </span>
        ) : r.nothingToPay ? (
          <StatusBadge tone="neutral">Nothing to pay</StatusBadge>
        ) : data.status === "approved" ? (
          <span>
            <StatusBadge tone="warning">With next payout</StatusBadge>
          </span>
        ) : (
          <StatusBadge tone="neutral">Not yet</StatusBadge>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      mobile: "actions",
      cell: (r) => (
        <Button asChild size="sm" variant="ghost" className="gap-1.5">
          <a
            href={`/api/admin/company/hr/payroll/${data.key}/payslip/${r.employeeId}`}
            target="_blank"
            rel="noreferrer"
          >
            <FileText className="size-4" />
            Payslip
          </a>
        </Button>
      ),
    },
  ];

  const pool = data.pool;
  const totalCard = (
    <StatCard
      label="Split this period"
      value={data.total}
      icon={CheckCircle2}
      tone={data.status === "approved" ? "success" : "warning"}
      hint={
        data.status === "approved"
          ? `Approved ${data.approvedAt ?? ""}`
          : "Draft — still recalculating"
      }
    />
  );

  return (
    <div className="grid gap-4">
      {pool ? (
        <div className="grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Cash after AIT"
            value={pool.netCash}
            icon={Banknote}
            tone="brand"
            hint="The sales report's figure for this period"
          />
          <StatCard
            label="Fixed salaries"
            value={pool.salaries}
            icon={Wallet}
            tone="info"
            hint="Earned in the period, taken off first"
          />
          <StatCard
            label="Split between directors"
            value={pool.distributable}
            icon={PieChart}
            tone={pool.nothingToSplit ? "warning" : "info"}
            hint={
              pool.totalShares > 0
                ? `${pool.allocatedShares.toLocaleString("en-BD")} of ${pool.totalShares.toLocaleString("en-BD")} shares held`
                : "No share pool set"
            }
          />
          {totalCard}
        </div>
      ) : (
        <div className="grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Revenue this month"
            value={data.revenue.total}
            icon={Banknote}
            tone="brand"
            hint="Counted when payment was received"
          />
          <StatCard
            label="From the website"
            value={data.revenue.online}
            icon={Globe}
            tone="info"
          />
          <StatCard
            label="From sales orders"
            value={data.revenue.manual}
            icon={Handshake}
            tone="info"
          />
          {totalCard}
        </div>
      )}

      {pool && (
        <SectionCard
          title="How the pool was worked out"
          description="The same figures as the sales report for this period, then salaries off the top."
        >
          <dl className="grid gap-1.5 text-sm sm:max-w-md">
            {(
              [
                ["Gross profit", pool.grossProfit, ""],
                ["Order costs", pool.orderCosts, "−"],
                ["Client visits", pool.expenses, "−"],
                ["AIT withheld by clients", pool.ait, "−"],
                ["Cash after AIT", pool.netCash, "="],
                ["Fixed salaries", pool.salaries, "−"],
                ["Split between directors", pool.distributable, "="],
              ] as const
            ).map(([label, value, sign]) => (
              <div key={label} className="grid gap-1">
                <div
                  className={`flex items-baseline justify-between gap-4 ${sign === "=" ? "border-t pt-1.5 font-medium" : ""}`}
                >
                  <dt className={sign === "=" ? "" : "text-muted-foreground"}>
                    {label}
                  </dt>
                  <dd className="tabular-nums">
                    {sign === "−" && (
                      <span className="text-muted-foreground mr-1">−</span>
                    )}
                    {value}
                  </dd>
                </div>
                {label === "Fixed salaries" &&
                  pool.salaryLines.map((s) => (
                    <div
                      key={s.name}
                      className="text-muted-foreground flex items-baseline justify-between gap-4 pl-4 text-xs"
                    >
                      <span>{s.name}</span>
                      <span className="tabular-nums">{s.amount}</span>
                    </div>
                  ))}
              </div>
            ))}
          </dl>
          {pool.nothingToSplit && (
            <p className="text-muted-foreground mt-3 text-xs">
              The period did not clear its salaries, so there is nothing to
              split. Nobody owes anything back.
            </p>
          )}
        </SectionCard>
      )}

      <SectionCard
        title={data.label}
        description={
          data.status === "approved"
            ? "Approved. These figures are frozen: a payment recorded for this period afterwards will not change them. Each director's share is paid with their next payout."
            : data.running
              ? "Draft. This period is still running, so it recalculates each time it is opened."
              : "Draft. This recalculates each time it is opened, because payments for the period may still arrive. Approve it to have the shares paid."
        }
        action={
          data.status === "approved" ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                setReason("");
                setReopening(true);
              }}
            >
              <RotateCcw className="size-4" />
              Reopen
            </Button>
          ) : (
            <Button
              size="sm"
              className="gap-1.5"
              disabled={busy || data.lines.length === 0}
              onClick={() =>
                call(
                  `/api/admin/company/hr/payroll/${data.key}`,
                  { action: "approve" },
                  "Payroll approved.",
                )
              }
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Approve
            </Button>
          )
        }
      >
        <DataTable
          columns={columns}
          rows={data.lines}
          getRowKey={(r) => r.employeeId}
          empty="Nobody held shares in this period."
          minWidth={720}
        />
      </SectionCard>

      {data.reimbursements.length > 0 && (
        <SectionCard
          title="Expenses being paid back"
          description="This month was approved before payouts, so it froze the claims approved for it. They are paid with the director's line of the month."
        >
          <ul className="divide-y">
            {data.reimbursements.map((r) => (
              <li
                key={r.employeeId}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{r.name}</span>
                  <span className="text-muted-foreground text-admin-xs block">
                    {r.claims} claim{r.claims === 1 ? "" : "s"}
                    {r.paid ? " · paid" : ""}
                  </span>
                </span>
                <span className="tabular-nums">{r.amount}</span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 pt-2.5 font-medium">
              <span>Total for the month</span>
              <span className="tabular-nums">{data.grandTotal}</span>
            </li>
          </ul>
        </SectionCard>
      )}

      <Dialog open={reopening} onOpenChange={(o) => !o && setReopening(false)}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Reopen {data.label}?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            The period goes back to a draft and will recalculate. This is
            refused once anyone has been paid from it.
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="reopen-reason">Reason</Label>
            <Input
              id="reopen-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopening(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !reason.trim()}
              onClick={() =>
                call(
                  `/api/admin/company/hr/payroll/${data.key}`,
                  { action: "reopen", reason },
                  "Reopened.",
                )
              }
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Reopen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
