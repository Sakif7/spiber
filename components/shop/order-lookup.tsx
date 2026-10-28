"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { CtaButton } from "@/components/ui/cta-button";
import { formatBDT } from "@/lib/money";
import { localize } from "@/lib/schemas/localized";
import { bcp47 } from "@/lib/i18n/intl-locale";
import type { Locale } from "@/i18n/routing";

type LookedUpOrder = {
  orderNumber: string;
  status: string;
  totalMinor: number;
  taxMinor?: number;
  taxRateBp?: number | null;
  roundingMinor?: number;
  /** offline | online | cod | credit — legacy orders report "offline". */
  paymentMethod?: string;
  paymentStatus?: string;
  /** An online order still waiting for its money. */
  paymentState?: {
    awaiting: boolean;
    canPayAgain: boolean;
    holdUntil: string | null;
    attemptsLeft: number;
    /** A credit / COD order still owed that can be paid online now. */
    canPayNow?: boolean;
  };
  /** A COD order paid online: nothing is collected at the door. */
  paidOnline?: boolean;
  /** Credit orders only: when the invoice falls due. */
  dueAt?: string | null;
  email: string;
  trackingNumber?: string | null;
  items: {
    productSnapshot: {
      name: { en: string; bn?: string };
      sku: string;
      variantOptions?: { name: string; value: string }[];
    };
    qty: number;
    lineTotalMinor: number;
  }[];
};

/** Per-status headline + tone; anything not listed keeps the thank-you copy. */
const STATUS_NOTE: Record<string, { key: string; color: string }> = {
  shipped: { key: "noteShipped", color: "var(--color-brand-deep)" },
  delivered: { key: "noteDelivered", color: "var(--color-success)" },
  cancelled: { key: "noteCancelled", color: "var(--color-error)" },
  refunded: { key: "noteRefunded", color: "var(--color-error)" },
};

/** The confirming page asks again this often, this many times, then stops. */
const POLL_MS = 3000;
const POLL_TIMES = 10;

export function OrderLookup({
  initialOrderNumber,
  initialEmail,
  paymentHint,
}: {
  initialOrderNumber?: string;
  initialEmail?: string;
  /**
   * How the customer came back from the gateway (paid / failed / cancelled /
   * pending / issue) — set by our own return route after asking PayStation.
   */
  paymentHint?: string;
}) {
  const t = useTranslations("shop.confirmation");
  // Payment-method labels live in the checkout namespace (single source).
  const tc = useTranslations("shop.checkout");
  const ti = useTranslations("invoice");
  const locale = useLocale() as Locale;
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber ?? "");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [query, setQuery] = useState<{ num: string; email: string } | null>(
    initialOrderNumber && initialEmail
      ? { num: initialOrderNumber, email: initialEmail }
      : null,
  );
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const qc = useQueryClient();
  // Every click spends one of the order's tries: a double click must not.
  const inFlight = useRef(false);

  const lookup = useQuery({
    queryKey: ["order-lookup", query?.num, query?.email],
    enabled: !!query,
    queryFn: async () => {
      const res = await fetch(
        `/api/orders/lookup?orderNumber=${encodeURIComponent(query!.num)}&email=${encodeURIComponent(query!.email)}`,
      );
      const json = await res.json();
      return res.ok && json.ok ? (json.data.order as LookedUpOrder) : null;
    },
    // Back from the gateway with the money not yet confirmed: keep asking for
    // half a minute, so the page turns to "paid" on its own.
    refetchInterval: (q) =>
      paymentHint === "pending" &&
      (q.state.data?.paymentState?.awaiting ||
        q.state.data?.paymentState?.canPayNow) &&
      q.state.dataUpdateCount < POLL_TIMES
        ? POLL_MS
        : false,
  });

  const order = lookup.data ?? null;
  const notFound = !!query && lookup.isFetched && !order;
  // Still inside the half-minute of asking (the hook re-renders on every answer).
  const updates =
    qc.getQueryState(["order-lookup", query?.num, query?.email])
      ?.dataUpdateCount ?? 0;
  const confirming = paymentHint === "pending" && updates < POLL_TIMES;

  async function payAgain() {
    if (!order || inFlight.current) return;
    inFlight.current = true;
    setPaying(true);
    setPayError(null);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(order.orderNumber)}/pay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: order.email, locale }),
        },
      );
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok && json.data.redirectUrl) {
        window.location.assign(json.data.redirectUrl);
        return;
      }
      const code = json?.error?.code;
      setPayError(
        code === "expired"
          ? t("expired")
          : code === "too_many_attempts"
            ? t("noMoreTries")
            : t("payAgainError"),
      );
      void lookup.refetch();
    } catch {
      setPayError(t("payAgainError"));
    }
    inFlight.current = false;
    setPaying(false);
  }

  if (order) {
    const statusNote = STATUS_NOTE[order.status];
    const ps = order.paymentState;
    const awaiting = !!ps?.awaiting;
    const holdTime =
      ps?.holdUntil &&
      new Date(ps.holdUntil).toLocaleTimeString(bcp47(locale), {
        hour: "2-digit",
        minute: "2-digit",
      });
    // A credit / COD order still owed, which the customer may pay online now.
    const owed = !awaiting && !!ps?.canPayNow;
    // What to say about the money, most specific first. The order itself
    // outranks the hint: an order that is paid is paid, however the customer
    // came back.
    const paymentLine =
      awaiting || owed
        ? confirming
          ? t("paymentPending")
          : paymentHint === "pending"
            ? t("paymentUnconfirmed")
            : paymentHint === "cancelled"
              ? t("paymentCancelled")
              : paymentHint === "issue"
                ? t("paymentIssue")
                : awaiting || paymentHint === "failed"
                  ? t("paymentFailed")
                  : null
        : paymentHint === "issue"
          ? t("paymentIssue")
          : (paymentHint === "paid" || paymentHint === "pending") &&
              order.paymentStatus === "paid"
            ? t("paymentPaid")
            : null;
    return (
      <div style={{ display: "grid", gap: "var(--s-4)", maxWidth: 560 }}>
        {awaiting ? (
          <div
            role="status"
            style={{
              display: "grid",
              gap: "var(--s-3)",
              padding: "var(--s-4)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--r-lg)",
              background: "var(--color-surface)",
            }}
          >
            <p style={{ margin: 0, fontSize: "var(--fs-body-lg)" }}>
              {paymentLine}
            </p>
            {ps?.canPayAgain ? (
              <>
                {holdTime ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: "var(--fs-small)",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {t("holdUntil", { time: holdTime })}
                  </p>
                ) : null}
                {!confirming ? (
                  <CtaButton onClick={payAgain}>
                    {paying ? t("payingAgain") : t("payAgain")}
                  </CtaButton>
                ) : null}
              </>
            ) : (
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--fs-small)",
                  color: "var(--color-text-muted)",
                }}
              >
                {ps && ps.attemptsLeft === 0 ? t("noMoreTries") : t("expired")}
              </p>
            )}
            {payError ? (
              <p
                role="alert"
                style={{
                  margin: 0,
                  color: "var(--color-error)",
                  fontSize: "var(--fs-small)",
                }}
              >
                {payError}
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <p
              style={{
                color: statusNote?.color ?? "var(--color-success)",
                fontSize: "var(--fs-body-lg)",
              }}
            >
              {statusNote ? t(statusNote.key) : t("thankYou")}
            </p>
            {paymentLine && !owed ? (
              <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
                {paymentLine}
              </p>
            ) : null}
            {owed ? (
              <div
                role="status"
                style={{
                  display: "grid",
                  gap: "var(--s-3)",
                  padding: "var(--s-4)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--r-lg)",
                  background: "var(--color-surface)",
                }}
              >
                {paymentLine ? (
                  <p style={{ margin: 0, fontSize: "var(--fs-body-lg)" }}>
                    {paymentLine}
                  </p>
                ) : null}
                {!confirming ? (
                  <>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "var(--fs-small)",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {t("payNowNote")}
                    </p>
                    <div>
                      <CtaButton onClick={payAgain}>
                        {paying ? t("payingAgain") : t("payNow")}
                      </CtaButton>
                    </div>
                  </>
                ) : null}
                {payError ? (
                  <p
                    role="alert"
                    style={{
                      margin: 0,
                      color: "var(--color-error)",
                      fontSize: "var(--fs-small)",
                    }}
                  >
                    {payError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        )}
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "6px 16px",
            margin: 0,
          }}
        >
          <dt style={{ color: "var(--color-text-muted)" }}>
            {t("orderNumber")}
          </dt>
          <dd style={{ margin: 0, fontFamily: "var(--font-mono)" }}>
            {order.orderNumber}
          </dd>
          <dt style={{ color: "var(--color-text-muted)" }}>{t("status")}</dt>
          <dd style={{ margin: 0, textTransform: "capitalize" }}>
            {order.status}
          </dd>
          {order.trackingNumber && (
            <>
              <dt style={{ color: "var(--color-text-muted)" }}>
                {t("tracking")}
              </dt>
              <dd style={{ margin: 0, fontFamily: "var(--font-mono)" }}>
                {order.trackingNumber}
              </dd>
            </>
          )}
          {order.paymentMethod && order.paymentMethod !== "offline" && (
            <>
              <dt style={{ color: "var(--color-text-muted)" }}>
                {t("paymentMethod")}
              </dt>
              <dd style={{ margin: 0 }}>
                {order.paymentMethod === "online"
                  ? t("methodOnline")
                  : order.paymentMethod === "cod"
                    ? tc("cod")
                    : tc("credit")}
                {order.paidOnline ? (
                  <span
                    style={{
                      display: "block",
                      color: "var(--color-success)",
                      fontSize: "var(--fs-small)",
                    }}
                  >
                    {t("paidOnlineNoCollect")}
                  </span>
                ) : null}
              </dd>
            </>
          )}
          {order.dueAt && (
            <>
              <dt style={{ color: "var(--color-text-muted)" }}>
                {t("dueDate")}
              </dt>
              <dd style={{ margin: 0 }}>
                {new Date(order.dueAt).toLocaleDateString(bcp47(locale))}
              </dd>
            </>
          )}
          {!!order.taxMinor && order.taxMinor > 0 && (
            <>
              <dt style={{ color: "var(--color-text-muted)" }}>
                {order.taxRateBp
                  ? `${t("vat")} (${order.taxRateBp / 100}%)`
                  : t("vat")}
              </dt>
              <dd style={{ margin: 0 }}>{formatBDT(order.taxMinor, locale)}</dd>
            </>
          )}
          {!!order.roundingMinor && (
            <>
              <dt style={{ color: "var(--color-text-muted)" }}>
                {t("rounding")}
              </dt>
              <dd style={{ margin: 0 }}>
                − {formatBDT(-order.roundingMinor, locale)}
              </dd>
            </>
          )}
          <dt style={{ color: "var(--color-text-muted)" }}>{t("total")}</dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>
            {formatBDT(order.totalMinor, locale)}
          </dd>
        </dl>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gap: 6,
          }}
        >
          {order.items.map((it, i) => (
            <li
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: "1px solid var(--color-hairline)",
                paddingTop: 6,
              }}
            >
              <span>
                {localize(it.productSnapshot.name, locale)}
                {(it.productSnapshot.variantOptions?.length ?? 0) > 0 && (
                  <span
                    style={{
                      color: "var(--color-text-muted)",
                      fontSize: "var(--fs-small)",
                    }}
                  >
                    {" "}
                    (
                    {it.productSnapshot
                      .variantOptions!.map((o) => o.value)
                      .join(" / ")}
                    )
                  </span>
                )}{" "}
                × {it.qty}
              </span>
              <span>{formatBDT(it.lineTotalMinor, locale)}</span>
            </li>
          ))}
        </ul>
        <p
          style={{
            fontSize: "var(--fs-small)",
            color: "var(--color-text-muted)",
          }}
        >
          {/* An order still waiting for its online payment has not been
              confirmed by email yet — that goes out with the payment. */}
          {awaiting ? order.email : `${t("emailedTo")} ${order.email}`}
        </p>
        {/* The email is carried so a guest can open their own invoice. */}
        <Link
          href={`/invoice/${order.orderNumber}?email=${encodeURIComponent(order.email)}`}
          style={{ color: "var(--color-brand-deep)", fontWeight: 600 }}
        >
          {ti("viewInvoice")}
        </Link>
        <p
          style={{
            fontSize: "var(--fs-small)",
            color: "var(--color-text-muted)",
            margin: 0,
          }}
        >
          {t("needHelp")}{" "}
          <Link
            href="/kart/returns"
            style={{ color: "var(--color-brand-deep)", fontWeight: 600 }}
          >
            {t("policyLink")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "var(--s-4)", maxWidth: 420 }}>
      <p style={{ color: "var(--color-text-muted)" }}>{t("lookupHint")}</p>
      <Input
        placeholder={t("orderNumber")}
        value={orderNumber}
        onChange={(e) => setOrderNumber(e.target.value)}
      />
      <Input
        placeholder="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {notFound && (
        <span
          style={{ color: "var(--color-error)", fontSize: "var(--fs-small)" }}
        >
          {t("notFound")}
        </span>
      )}
      <CtaButton onClick={() => setQuery({ num: orderNumber, email })}>
        {t("lookup")}
      </CtaButton>
    </div>
  );
}
