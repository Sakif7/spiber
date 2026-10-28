import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/repositories/orders.repo";
import { formatBDT } from "@/lib/money";
import { OrderActions } from "@/components/admin/order-actions";
import { DetailCard } from "@/components/admin/ui/detail";
import { EditorHeader } from "@/components/admin/ui/form-shell";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import {
  PaymentAttemptsCard,
  toAttemptRows,
} from "@/components/admin/payments/payment-attempts-card";
import { attemptsForSubject } from "@/lib/repositories/payment-attempts.repo";
import { isGatewayProvider } from "@/lib/schemas/order";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** How the order is paid, in plain words for the admin summary. */
const PAYMENT_METHOD_LABEL: Record<string, string> = {
  offline: "Offline (bank transfer / arranged)",
  online: "Online (PayStation)",
  cod: "Cash on delivery",
  credit: "Credit account",
};

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

type LocalizedField = { en: string; bn?: string };

type PlainItem = {
  productSnapshot: { name: LocalizedField; sku: string; priceMinor: number };
  qty: number;
  lineTotalMinor: number;
};

type PlainTimeline = {
  status: string;
  at: string | Date;
  note?: string;
  internalNote?: string;
};

type PlainOrder = {
  _id: unknown;
  orderNumber: string;
  email: string;
  status: string;
  subtotalMinor: number;
  shippingMinor: number;
  discountMinor: number;
  taxMinor: number;
  /** Absent on orders placed before rounding (2026-10-28). */
  roundingMinor?: number;
  /** VAT rate actually charged, in basis points (null = none). */
  taxRateBp?: number | null;
  totalMinor: number;
  storefront?: "instruments" | "marketplace";
  items: PlainItem[];
  shippingAddress: {
    label?: string;
    line1: string;
    line2?: string;
    city: string;
    district: string;
    postalCode?: string;
    phone: string;
  };
  payment: {
    provider: string;
    status: string;
    paidAt?: string | Date;
    /** offline | cod | credit — absent on legacy orders. */
    method?: string;
    termsDays?: number | null;
    dueAt?: string | Date | null;
  };
  trackingNumber?: string;
  refundRequest?: {
    reason: string;
    requestedAt: string | Date;
    status: "open" | "resolved";
  } | null;
  timeline: PlainTimeline[];
  createdAt: string | Date;
};

/** Table chrome copied from the shared admin DataTable so every table reads
 *  the same; the items table lives inside a detail card, so it uses the
 *  shadcn table primitives directly rather than nesting a card in a card. */
const TH = "text-muted-foreground h-9 px-3 font-semibold";
const TD = "px-3 py-2 align-middle";

function fmtDate(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <span className="text-muted-foreground text-xs tracking-[0.06em] uppercase">
        {label}
      </span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  let order: PlainOrder | null = null;
  try {
    const doc = await getOrderById(id);
    if (doc) order = doc.toObject() as unknown as PlainOrder;
  } catch {
    order = null;
  }

  if (!order) notFound();
  const o = order;

  // Every try at the gateway, paid at checkout or later from the account.
  const attempts = (
    await Promise.all([
      attemptsForSubject("order", id).catch(() => []),
      attemptsForSubject("order_due", id).catch(() => []),
    ])
  ).flat();
  const attemptRows = toAttemptRows(attempts);
  const awaitingOnline =
    o.status === "pending" &&
    o.payment?.method === "online" &&
    o.payment?.status !== "paid";
  const canRecheck =
    awaitingOnline ||
    attempts.some((a) => a.status === "open" || a.status === "abandoned");
  const paidOnline = attempts.some((a) => a.status === "paid");
  // Cash on delivery, but paid online since: the courier must not collect.
  const noCollect =
    o.payment?.method === "cod" &&
    o.payment?.status === "paid" &&
    isGatewayProvider(o.payment?.provider);

  return (
    <div className="space-y-4">
      <EditorHeader
        backHref="/admin/orders"
        backLabel="Back to orders"
        title={<>Order {o.orderNumber}</>}
      />

      <DetailCard title="Summary">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
          <Field label="Order number" value={o.orderNumber} />
          <Field label="Placed" value={fmtDate(o.createdAt)} />
          <Field
            label="Store"
            value={o.storefront === "instruments" ? "Medtrade" : "Spiber Kart"}
          />
          <Field label="Status" value={<StatusBadge>{o.status}</StatusBadge>} />
          <Field
            label="Payment"
            value={
              <span className="capitalize">
                {o.payment?.status ?? "—"}
                {o.payment?.provider ? ` · ${o.payment.provider}` : ""}
              </span>
            }
          />
          <Field
            label="Method"
            value={
              noCollect ? (
                <span className="grid justify-items-start gap-1">
                  {PAYMENT_METHOD_LABEL.cod}
                  <StatusBadge tone="success">
                    Paid online — don&apos;t collect
                  </StatusBadge>
                </span>
              ) : (
                PAYMENT_METHOD_LABEL[o.payment?.method ?? "offline"]
              )
            }
          />
          {o.payment?.dueAt ? (
            <Field
              label={`Payment due${
                o.payment.termsDays ? ` (Net ${o.payment.termsDays})` : ""
              }`}
              value={fmtDate(o.payment.dueAt)}
            />
          ) : null}
          {o.payment?.paidAt ? (
            <Field label="Paid at" value={fmtDate(o.payment.paidAt)} />
          ) : null}
          <Field label="Customer email" value={o.email} />
          {o.trackingNumber ? (
            <Field
              label="Tracking"
              value={
                <span className="font-mono text-xs">{o.trackingNumber}</span>
              }
            />
          ) : null}
        </div>
      </DetailCard>

      <DetailCard title="Shipping address">
        <address className="text-foreground leading-relaxed not-italic">
          {o.shippingAddress.label ? (
            <div className="text-muted-foreground">
              {o.shippingAddress.label}
            </div>
          ) : null}
          <div>{o.shippingAddress.line1}</div>
          {o.shippingAddress.line2 ? (
            <div>{o.shippingAddress.line2}</div>
          ) : null}
          <div>
            {o.shippingAddress.city}, {o.shippingAddress.district}
            {o.shippingAddress.postalCode
              ? ` ${o.shippingAddress.postalCode}`
              : ""}
          </div>
          <div className="font-mono text-xs">{o.shippingAddress.phone}</div>
        </address>
      </DetailCard>

      <DetailCard
        title="Items"
        bodyClassName="min-w-0 grid-cols-[minmax(0,1fr)] px-0"
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={TH}>Product</TableHead>
              <TableHead className={TH}>SKU</TableHead>
              <TableHead className={`${TH} text-right`}>Unit</TableHead>
              <TableHead className={`${TH} text-right`}>Qty</TableHead>
              <TableHead className={`${TH} text-right`}>Line total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {o.items.map((item, idx) => (
              <TableRow key={`${item.productSnapshot.sku}-${idx}`}>
                <TableCell className={`${TD} text-foreground font-medium`}>
                  {item.productSnapshot.name?.en ?? "—"}
                </TableCell>
                <TableCell className={`${TD} font-mono text-xs`}>
                  {item.productSnapshot.sku}
                </TableCell>
                <TableCell className={`${TD} text-right tabular-nums`}>
                  {formatBDT(item.productSnapshot.priceMinor)}
                </TableCell>
                <TableCell className={`${TD} text-right tabular-nums`}>
                  {item.qty}
                </TableCell>
                <TableCell className={`${TD} text-right tabular-nums`}>
                  {formatBDT(item.lineTotalMinor)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-4 ml-auto flex w-full max-w-[320px] flex-col gap-2 px-4">
          <TotalRow label="Subtotal" value={formatBDT(o.subtotalMinor)} />
          <TotalRow label="Shipping" value={formatBDT(o.shippingMinor)} />
          <TotalRow
            label="Discount"
            value={
              o.discountMinor > 0
                ? `− ${formatBDT(o.discountMinor)}`
                : formatBDT(0)
            }
          />
          {o.taxMinor > 0 ? (
            <TotalRow
              label={o.taxRateBp ? `VAT (${o.taxRateBp / 100}%)` : "VAT"}
              value={formatBDT(o.taxMinor)}
            />
          ) : null}
          {(o.roundingMinor ?? 0) !== 0 ? (
            <TotalRow
              label="Rounding"
              value={`− ${formatBDT(-(o.roundingMinor ?? 0))}`}
            />
          ) : null}
          <div className="text-foreground flex justify-between border-t pt-2 text-sm font-bold">
            <span>Total</span>
            <span className="tabular-nums">{formatBDT(o.totalMinor)}</span>
          </div>
        </div>
      </DetailCard>

      {o.payment?.method === "online" || attemptRows.length > 0 ? (
        <PaymentAttemptsCard
          rows={attemptRows}
          recheckUrl={
            canRecheck
              ? `/api/admin/orders/${String(o._id)}/payments/recheck`
              : null
          }
        />
      ) : null}

      {o.refundRequest ? (
        <DetailCard
          title="Refund request"
          action={<StatusBadge>{o.refundRequest.status}</StatusBadge>}
          className={
            o.refundRequest.status === "open"
              ? "border-[var(--tone-warning)]"
              : undefined
          }
        >
          <p className="text-foreground">
            Requested {fmtDate(o.refundRequest.requestedAt)} —{" "}
            {o.refundRequest.reason}
          </p>
          {o.refundRequest.status === "open" ? (
            <p className="text-muted-foreground">
              Settle it with the Cancel/Refund actions below — the request
              resolves automatically.
            </p>
          ) : null}
        </DetailCard>
      ) : null}

      <DetailCard title="Timeline">
        {o.timeline.length === 0 ? (
          <p className="text-muted-foreground">No timeline events.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {o.timeline.map((event, idx) => (
              <li
                key={`${event.status}-${idx}`}
                className="flex flex-wrap items-baseline gap-3"
              >
                <StatusBadge>{event.status}</StatusBadge>
                <span className="text-muted-foreground">
                  {fmtDate(event.at)}
                </span>
                {event.note ? (
                  <span className="text-foreground">— {event.note}</span>
                ) : null}
                {event.internalNote ? (
                  <span className="text-muted-foreground italic">
                    (internal: {event.internalNote})
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </DetailCard>

      <OrderActions
        orderId={String(o._id)}
        status={o.status}
        paymentMethod={o.payment?.method ?? "offline"}
        paymentStatus={o.payment?.status ?? "unpaid"}
        paidOnline={paidOnline}
      />
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground tabular-nums">{value}</span>
    </div>
  );
}
