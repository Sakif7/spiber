import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { formatBDT } from "@/lib/money";
import { bcp47 } from "@/lib/i18n/intl-locale";
import { CONTACT } from "@/lib/contact";
import type { Locale } from "@/i18n/routing";
import { payLinkView } from "@/lib/services/payment-link.service";
import { PayNowPanel } from "@/components/payments/pay-now-panel";

export const dynamic = "force-dynamic";

// One client's bill: never indexed, and the token in the address never
// travels to PayStation (or anywhere else) in a Referer header.
export const metadata = {
  title: "Pay online",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * A pay link: what is being paid, how much, and the Pay button — or, once it
 * is done, that it is done. No sign-in; the token is the key.
 */
export default async function PayLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, token } = await params;
  const sp = await searchParams;
  // Set by our own return route after asking PayStation what happened.
  const paymentHint = typeof sp.payment === "string" ? sp.payment : undefined;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "payments.link" });

  const view = await payLinkView(token);
  if (!view) notFound();

  const done = view.state === "paid" || view.state === "settled";
  // A withdrawn or out-of-date link's figures are no longer what is owed.
  const showMoney = view.state !== "closed" && view.state !== "outdated";
  // A tourism quote is not an invoice: its own words, the patient's name.
  const quote = view.kind !== "invoice";
  const title =
    view.state === "paid"
      ? t("paidTitle")
      : view.state === "settled"
        ? t("settledTitle")
        : view.state === "closed"
          ? t("closedTitle")
          : view.kind === "case"
            ? t("titleCase", { ref: view.ref })
            : view.kind === "travel"
              ? t("titleTravel", { ref: view.ref })
              : t("title", { ref: view.ref });
  const note =
    view.state === "paid"
      ? t(quote ? "paidNoteQuote" : "paidNote")
      : view.state === "settled"
        ? t("settledNote")
        : view.state === "closed"
          ? t("closedNote")
          : view.state === "outdated"
            ? t(quote ? "outdatedNoteQuote" : "outdatedNote")
            : view.state === "unavailable"
              ? t("unavailableNote")
              : t(quote ? "openNoteQuote" : "openNote");
  const billedTo = quote ? view.payerName : view.organisation;

  return (
    <section style={{ paddingBlock: "clamp(56px, 8vw, 120px)" }}>
      <Container style={{ maxWidth: 600, display: "grid", gap: "var(--s-5)" }}>
        <div
          style={{ textAlign: "center", display: "grid", gap: "var(--s-3)" }}
        >
          <span
            aria-hidden
            style={{
              justifySelf: "center",
              display: "grid",
              placeItems: "center",
              width: 56,
              height: 56,
              borderRadius: "var(--r-pill)",
              background: done
                ? "var(--color-brand-soft)"
                : "var(--color-secondary-soft)",
              color: done
                ? "var(--color-brand-deep)"
                : "var(--color-secondary-deep)",
              fontSize: 28,
            }}
          >
            {done ? "✓" : "•"}
          </span>
          <h1
            style={{
              fontSize: "var(--fs-h2)",
              color: "var(--color-text-strong)",
              margin: 0,
            }}
          >
            {title}
          </h1>
          <p
            style={{
              color: "var(--color-text-muted)",
              fontSize: "var(--fs-body-lg)",
              margin: 0,
            }}
          >
            {note}
          </p>
          {paymentHint === "issue" ? (
            <p role="status" style={{ margin: 0 }}>
              {t(quote ? "issueNoteQuote" : "issueNote")}
            </p>
          ) : null}
        </div>

        <div
          style={{
            display: "grid",
            gap: 8,
            padding: "var(--s-5)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--r-lg)",
            background: "var(--color-surface)",
          }}
        >
          <Row
            label={quote ? t("reference") : t("invoice")}
            value={view.ref}
            mono
          />
          {billedTo ? <Row label={t("billedTo")} value={billedTo} /> : null}
          {showMoney && view.withheldMinor > 0 ? (
            <>
              <Row
                label={t("invoiceTotal")}
                value={formatBDT(view.totalMinor, l)}
              />
              <Row
                label={t("withheld")}
                value={`− ${formatBDT(view.withheldMinor, l)}`}
              />
            </>
          ) : null}
          {showMoney && view.roundingMinor !== 0 ? (
            <Row
              label={t("rounding")}
              value={`− ${formatBDT(-view.roundingMinor, l)}`}
            />
          ) : null}
          {showMoney ? (
            <Row
              label={view.state === "paid" ? t("paidAmount") : t("amount")}
              value={formatBDT(view.amountMinor, l)}
            />
          ) : null}
          {view.state === "paid" && view.paidAt ? (
            <Row
              label={t("paidOn")}
              value={new Date(view.paidAt).toLocaleDateString(bcp47(l), {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            />
          ) : null}
          {view.state === "paid" && view.trxId ? (
            <Row label={t("transaction")} value={view.trxId} mono />
          ) : null}
        </div>

        {view.state === "open" ? (
          <PayNowPanel
            kind="link"
            reference={token}
            askPhone={view.askPhone}
            hint={paymentHint}
          />
        ) : null}

        <p
          style={{
            textAlign: "center",
            color: "var(--color-text-muted)",
            fontSize: "var(--fs-small)",
            margin: 0,
          }}
        >
          {t("contact", {
            email: quote ? CONTACT.generalEmail : CONTACT.salesEmail,
            phone: CONTACT.phone,
          })}
        </p>
      </Container>
    </section>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "var(--s-4)",
      }}
    >
      <span
        style={{
          color: "var(--color-text-muted)",
          fontSize: "var(--fs-body-sm)",
        }}
      >
        {label}
      </span>
      <strong
        style={{
          color: "var(--color-text-strong)",
          fontFamily: mono ? "var(--font-mono)" : "inherit",
          wordBreak: mono ? "break-all" : undefined,
        }}
      >
        {value}
      </strong>
    </div>
  );
}
