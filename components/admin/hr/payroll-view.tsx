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
  paidAt: string | null;
  reference: string | null;
};

/**
 * How the month's pool was arrived at, every figure already formatted.
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
  distributable: string;
  totalShares: number;
  allocatedShares: number;
  /** True when the month came out at or below zero after salaries. */
  nothingToSplit: boolean;
};

export type ReimbursementRow = {
  employeeId: string;
  name: string;
  amount: string;
  claims: number;
};

export type PayrollViewData = {
  month: string;
  monthLabel: string;
  status: "draft" | "approved";
  revenue: { total: string; online: string; manual: string };
  pool: PayrollPoolView | null;
  /** Shares and salaries alone. */
  total: string;
  /** Expenses being handed back this month, added on top of the share. */
  reimbursements: ReimbursementRow[];
  reimbursementTotal: string;
  grandTotal: string;
  lines: PayrollLineRow[];
  approvedAt: string | null;
};

/**
 * One month's payroll.
 *
 * A draft recomputes every time it is opened, because money for the month is
 * still arriving; approving it freezes the figures. That distinction is the
 * point of the screen, so it is stated rather than implied.
 */
export function PayrollView({ data }: { data: PayrollViewData }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [payFor, setPayFor] = useState<PayrollLineRow | null>(null);
  const [reference, setReference] = useState("");
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
        toast.error(formatApiError(json, "That didn't work."));
        return false;
      }
      toast.success(okMessage);
      setPayFor(null);
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
        r.paidAt ? (
          <span>
            <StatusBadge tone="success">Paid</StatusBadge>
            <span className="text-muted-foreground block text-xs">
              {new Date(r.paidAt).toLocaleDateString()}
              {r.reference ? ` · ${r.reference}` : ""}
            </span>
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
        <span className="flex items-center justify-end gap-1">
          <Button asChild size="sm" variant="ghost" className="gap-1.5">
            <a
              href={`/api/admin/company/hr/payroll/${data.month}/payslip/${r.employeeId}`}
              target="_blank"
              rel="noreferrer"
            >
              <FileText className="size-4" />
              Payslip
            </a>
          </Button>
          {data.status === "approved" && !r.paidAt && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setReference("");
                setPayFor(r);
              }}
            >
              Mark paid
            </Button>
          )}
        </span>
      ),
    },
  ];

  const pool = data.pool;
  const totalCard = (
    <StatCard
      label="Payroll total"
      value={data.total}
      icon={CheckCircle2}
      tone={data.status === "approved" ? "success" : "warning"}
      hint={
        data.status === "approved"
          ? `Approved ${data.approvedAt ? new Date(data.approvedAt).toLocaleDateString() : ""}`
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
            hint="The sales report's figure for this month"
          />
          <StatCard
            label="Fixed salaries"
            value={pool.salaries}
            icon={Wallet}
            tone="info"
            hint="Paid before any share"
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
          description="The same figures as the sales report for this month, then salaries off the top."
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
              <div
                key={label}
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
            ))}
          </dl>
          {pool.nothingToSplit && (
            <p className="text-muted-foreground mt-3 text-xs">
              The month did not clear its salaries, so there is nothing to
              split. Nobody owes anything back.
            </p>
          )}
        </SectionCard>
      )}

      <SectionCard
        title={data.monthLabel}
        description={
          data.status === "approved"
            ? "Approved. These figures are frozen: a payment recorded for this month afterwards will not change them."
            : "Draft. This recalculates each time it is opened, because payments for the month are still arriving."
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
                  `/api/admin/company/hr/payroll/${data.month}`,
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
          empty="Nobody held shares or drew a salary this month."
          minWidth={720}
        />
      </SectionCard>

      {data.reimbursements.length > 0 && (
        <SectionCard
          title="Expenses being paid back"
          description={
            data.status === "approved"
              ? "Settled with this month's payroll."
              : "Approved claims waiting for this month. They are added on top of the revenue share — they never reduce the revenue it is calculated from."
          }
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
                  </span>
                </span>
                <span className="tabular-nums">{r.amount}</span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 pt-2.5 font-medium">
              <span>Total to pay this month</span>
              <span className="tabular-nums">{data.grandTotal}</span>
            </li>
          </ul>
        </SectionCard>
      )}

      <Dialog
        open={payFor !== null}
        onOpenChange={(o) => !o && setPayFor(null)}
      >
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Mark {payFor?.name} as paid</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="pay-ref">Reference</Label>
            <Input
              id="pay-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Transfer or cheque number"
              maxLength={120}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayFor(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                payFor &&
                call(
                  `/api/admin/company/hr/payroll/${data.month}/lines/${payFor.employeeId}`,
                  { reference },
                  "Recorded as paid.",
                )
              }
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reopening} onOpenChange={(o) => !o && setReopening(false)}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Reopen {data.monthLabel}?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            The month goes back to a draft and will recalculate. This is refused
            once anyone has been paid.
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
                  `/api/admin/company/hr/payroll/${data.month}`,
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
