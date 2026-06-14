import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect, notFound } from "next/navigation";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { PageHeader } from "@/components/ui/page-header";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { formatBDT } from "@/lib/money";
import { localize } from "@/lib/schemas/localized";
import { getSessionUser } from "@/lib/auth/current-user";
import { getQuotationByNumber } from "@/lib/repositories/quotations.repo";
import { bcp47 } from "@/lib/i18n/intl-locale";

export const dynamic = "force-dynamic";

function formatDate(value: Date | string | null, locale: Locale): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(bcp47(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export default async function AccountQuotationDetail({
  params,
}: {
  params: Promise<{ locale: string; number: string }>;
}) {
  const { locale, number } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "quotation" });

  const user = await getSessionUser();
  if (!user) {
    redirect(
      `/${locale}?auth=login&next=/${locale}/account/quotations/${number}`,
    );
  }

  const q = await getQuotationByNumber(number).catch(() => null);
  if (!q) notFound();
  // Ownership guard (admins may also view).
  const isOwner = q.requesterId && String(q.requesterId) === user.sub;
  const isAdmin = user.roles?.some((r) => r === "admin" || r === "super_admin");
  if (!isOwner && !isAdmin) notFound();

  return (
    <>
      <PageHeader
        title={`${t("pageTitle")} ${q.quotationNumber}`}
        breadcrumbs={[
          { label: "Account", href: "/account" },
          { label: t("myQuotations"), href: "/account/quotations" },
          { label: q.quotationNumber },
        ]}
      />
      <Section py="clamp(40px, 5vw, 72px)">
        <Container
          style={{ display: "grid", gap: "var(--s-6)", maxWidth: 820 }}
        >
          {/* Status + quote summary */}
          <div style={card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "var(--s-4)",
              }}
            >
              <div>
                <div style={muted}>{t("status")}</div>
                <div
                  style={{
                    fontWeight: 700,
                    textTransform: "capitalize",
                    fontSize: "var(--fs-h6)",
                  }}
                >
                  {t(`statuses.${q.status}`)}
                </div>
              </div>
              <div>
                <div style={muted}>{t("date")}</div>
                <div>{formatDate(q.createdAt, l)}</div>
              </div>
              <div>
                <div style={muted}>{t("deliverTo")}</div>
                <div>
                  {q.deliveryLocation.city
                    ? `${q.deliveryLocation.city}, `
                    : ""}
                  {q.deliveryLocation.district}
                </div>
              </div>
            </div>
            {q.quote?.amountMinor != null && (
              <div
                style={{
                  marginTop: "var(--s-4)",
                  paddingTop: "var(--s-4)",
                  borderTop: "1px solid var(--color-border)",
                }}
              >
                <div style={muted}>{t("quotedTotal")}</div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--fs-h3)",
                    color: "var(--color-brand-deep)",
                    fontWeight: 700,
                  }}
                >
                  {formatBDT(q.quote.amountMinor, l)}
                </div>
                {q.quote.validUntil && (
                  <div style={muted}>
                    {t("validUntil")}: {formatDate(q.quote.validUntil, l)}
                  </div>
                )}
                {q.quote.note && <p style={{ marginTop: 8 }}>{q.quote.note}</p>}
                {q.quote.fileKey && (
                  <Link
                    href={q.quote.fileKey as string}
                    style={{
                      color: "var(--color-brand-deep)",
                      textDecoration: "underline",
                      fontWeight: 600,
                    }}
                  >
                    {t("downloadQuote")}
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Line items */}
          <div style={card}>
            <h2 style={sectionTitle}>{t("itemsTitle")}</h2>
            {q.items.map((it, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: "var(--s-3)",
                  alignItems: "center",
                  padding: "var(--s-3) 0",
                  borderTop: i === 0 ? "none" : "1px solid var(--color-border)",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: 48,
                    height: 48,
                    flexShrink: 0,
                    borderRadius: "var(--r-sm)",
                    overflow: "hidden",
                    background: "var(--color-surface-2)",
                  }}
                >
                  {it.productSnapshot.image && (
                    <Image
                      src={it.productSnapshot.image}
                      alt=""
                      fill
                      style={{ objectFit: "cover" }}
                      sizes="48px"
                    />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link
                    href={`/medtrade/product/${it.productSnapshot.slug}`}
                    style={{
                      color: "var(--color-text-strong)",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    {localize(it.productSnapshot.name, l)}
                  </Link>
                  <div style={muted}>
                    {it.productSnapshot.variantOptions &&
                    it.productSnapshot.variantOptions.length > 0
                      ? `${it.productSnapshot.variantOptions.map((o) => o.value).join(" · ")} · `
                      : ""}
                    {it.productSnapshot.sku}
                  </div>
                </div>
                <div style={{ fontWeight: 600 }}>× {it.quantity}</div>
              </div>
            ))}
          </div>

          {q.notes && (
            <div style={card}>
              <h2 style={sectionTitle}>{t("notes")}</h2>
              <p style={{ whiteSpace: "pre-line", color: "var(--color-text)" }}>
                {q.notes}
              </p>
            </div>
          )}
        </Container>
      </Section>
    </>
  );
}

const card: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-lg)",
  background: "var(--color-surface)",
  padding: "var(--s-6)",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "var(--fs-h6)",
  color: "var(--color-text-strong)",
  fontWeight: 700,
  marginBottom: "var(--s-3)",
};

const muted: React.CSSProperties = {
  fontSize: "var(--fs-caption)",
  color: "var(--color-text-muted)",
};
