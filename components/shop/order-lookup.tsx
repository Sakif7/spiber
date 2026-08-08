"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { CtaButton } from "@/components/ui/cta-button";
import { formatBDT } from "@/lib/money";
import { localize } from "@/lib/schemas/localized";
import type { Locale } from "@/i18n/routing";

type LookedUpOrder = {
  orderNumber: string;
  status: string;
  totalMinor: number;
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

export function OrderLookup({
  initialOrderNumber,
  initialEmail,
}: {
  initialOrderNumber?: string;
  initialEmail?: string;
}) {
  const t = useTranslations("shop.confirmation");
  const locale = useLocale() as Locale;
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber ?? "");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [query, setQuery] = useState<{ num: string; email: string } | null>(
    initialOrderNumber && initialEmail
      ? { num: initialOrderNumber, email: initialEmail }
      : null,
  );

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
  });

  const order = lookup.data ?? null;
  const notFound = !!query && lookup.isFetched && !order;

  if (order) {
    const statusNote = STATUS_NOTE[order.status];
    return (
      <div style={{ display: "grid", gap: "var(--s-4)", maxWidth: 560 }}>
        <p
          style={{
            color: statusNote?.color ?? "var(--color-success)",
            fontSize: "var(--fs-body-lg)",
          }}
        >
          {statusNote ? t(statusNote.key) : t("thankYou")}
        </p>
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
          {t("emailedTo")} {order.email}
        </p>
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
