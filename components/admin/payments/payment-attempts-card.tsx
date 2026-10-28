import { DetailCard } from "@/components/admin/ui/detail";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBDT } from "@/lib/money";
import {
  ATTEMPT_STATUS_VIEW,
  type PaymentAttemptStatus,
  type PaymentIssue,
} from "@/lib/schemas/payment";
import { RecheckPaymentButton } from "./recheck-payment-button";
import type { LeanAttempt } from "@/lib/repositories/payment-attempts.repo";

/** One try at the gateway, as the admin sees it (plain, serializable). */
export type AttemptRow = {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  amountMinor: number;
  status: PaymentAttemptStatus;
  issue: PaymentIssue | null;
  mode: string;
  method: string | null;
  trxId: string | null;
  payerMobile: string | null;
  feeMinor: number | null;
  refundReference: string | null;
};

const ISSUE_TEXT: Record<PaymentIssue, string> = {
  late: "arrived after it was cancelled",
  duplicate: "it was already paid",
  amount_mismatch: "wrong amount",
  cancelled: "cancelled after payment",
};

/** The plain rows the card shows, from the stored attempts (newest first). */
export function toAttemptRows(attempts: LeanAttempt[]): AttemptRow[] {
  return [...attempts]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .map((a) => ({
      id: String(a._id),
      invoiceNumber: a.invoiceNumber,
      createdAt: new Date(a.createdAt).toISOString(),
      amountMinor: a.paidMinor ?? a.amountMinor,
      status: a.status,
      issue: a.issue ?? null,
      mode: a.mode,
      method: a.method ?? null,
      trxId: a.trxId ?? null,
      payerMobile: a.payerMobile ?? null,
      feeMinor: a.feeMinor ?? null,
      refundReference: a.refund?.reference ?? null,
    }));
}

/** Same table chrome as the order's items table. */
const TH = "text-muted-foreground h-9 px-3 font-semibold";
const TD = "px-3 py-2 align-middle";

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Every try at the gateway for one order: what PayStation says was paid, by
 * what, and what it cost — and the button that asks PayStation again.
 */
export function PaymentAttemptsCard({
  rows,
  recheckUrl,
}: {
  rows: AttemptRow[];
  /** Shown while any try could still turn into money. */
  recheckUrl: string | null;
}) {
  return (
    <DetailCard
      title="Online payment"
      action={recheckUrl ? <RecheckPaymentButton url={recheckUrl} /> : null}
      bodyClassName="min-w-0 grid-cols-[minmax(0,1fr)] px-0"
    >
      {rows.length === 0 ? (
        <p className="text-muted-foreground px-4">
          Not handed to the gateway yet.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={TH}>Invoice</TableHead>
              <TableHead className={TH}>Started</TableHead>
              <TableHead className={TH}>Status</TableHead>
              <TableHead className={TH}>Paid with</TableHead>
              <TableHead className={TH}>Transaction</TableHead>
              <TableHead className={`${TH} text-right`}>Amount</TableHead>
              <TableHead className={`${TH} text-right`}>Fee</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const view = ATTEMPT_STATUS_VIEW[r.status];
              return (
                <TableRow key={r.id}>
                  <TableCell className={`${TD} font-mono text-xs`}>
                    {r.invoiceNumber}
                    {r.mode !== "live" ? (
                      <span className="text-muted-foreground ml-1.5 font-sans">
                        ({r.mode})
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className={TD}>{fmt(r.createdAt)}</TableCell>
                  <TableCell className={TD}>
                    <StatusBadge tone={view.tone}>{view.label}</StatusBadge>
                    {r.issue ? (
                      <span className="text-muted-foreground mt-0.5 block text-xs">
                        {ISSUE_TEXT[r.issue]}
                      </span>
                    ) : null}
                    {r.refundReference ? (
                      <span className="text-muted-foreground mt-0.5 block text-xs">
                        Refund ref {r.refundReference}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className={TD}>
                    {r.method ?? "—"}
                    {r.payerMobile ? (
                      <span className="text-muted-foreground block font-mono text-xs">
                        {r.payerMobile}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className={`${TD} font-mono text-xs`}>
                    {r.trxId ?? "—"}
                  </TableCell>
                  <TableCell className={`${TD} text-right tabular-nums`}>
                    {formatBDT(r.amountMinor)}
                  </TableCell>
                  <TableCell className={`${TD} text-right tabular-nums`}>
                    {r.feeMinor != null ? formatBDT(r.feeMinor) : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </DetailCard>
  );
}
