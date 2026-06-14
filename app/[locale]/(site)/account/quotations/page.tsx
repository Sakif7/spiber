import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { PageHeader } from "@/components/ui/page-header";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { CtaButton } from "@/components/ui/cta-button";
import { formatBDT } from "@/lib/money";
import { getSessionUser } from "@/lib/auth/current-user";
import { listQuotationsByRequester } from "@/lib/repositories/quotations.repo";
import { bcp47 } from "@/lib/i18n/intl-locale";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  new: "var(--color-text-muted)",
  quoted: "var(--color-brand)",
  negotiating: "var(--color-secondary-deep)",
  won: "var(--color-success)",
  lost: "var(--color-error)",
};

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

export default async function AccountQuotationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "quotation" });

  const user = await getSessionUser();
  if (!user) {
    redirect(`/${locale}?auth=login&next=/${locale}/account/quotations`);
  }

  const rows = await listQuotationsByRequester(user.sub).catch(() => []);

  return (
    <>
      <PageHeader
        title={t("myQuotations")}
        breadcrumbs={[
          { label: "Account", href: "/account" },
          { label: t("myQuotations") },
        ]}
      />
      <Section py="clamp(48px, 6vw, 80px)">
        <Container>
          {rows.length === 0 ? (
            <div style={emptyBox}>
              <p
                style={{
                  fontSize: "var(--fs-body-lg)",
                  color: "var(--color-text-strong)",
                }}
              >
                {t("emptyTitle")}
              </p>
              <p
                style={{
                  fontSize: "var(--fs-body)",
                  color: "var(--color-text-muted)",
                  maxWidth: "48ch",
                }}
              >
                {t("emptyNote")}
              </p>
              <CtaButton href="/medtrade" variant="primary">
                {t("browseCatalog")}
              </CtaButton>
            </div>
          ) : (
            <div
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: "var(--r-lg)",
                background: "var(--color-surface)",
                overflow: "hidden",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "var(--fs-body)",
                }}
              >
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th style={th}>{t("reference")}</th>
                    <th style={th}>{t("date")}</th>
                    <th style={th}>{t("items")}</th>
                    <th style={th}>{t("status")}</th>
                    <th style={{ ...th, textAlign: "right" }}>
                      {t("quotedTotal")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((q) => (
                    <tr key={q.quotationNumber}>
                      <td style={td}>
                        <Link
                          href={`/account/quotations/${q.quotationNumber}`}
                          style={{
                            fontFamily: "var(--font-mono)",
                            color: "var(--color-brand-deep)",
                            textDecoration: "none",
                            fontWeight: 600,
                          }}
                        >
                          {q.quotationNumber}
                        </Link>
                      </td>
                      <td style={{ ...td, color: "var(--color-text-muted)" }}>
                        {formatDate(q.createdAt, l)}
                      </td>
                      <td style={td}>{q.items.length}</td>
                      <td style={td}>
                        <span
                          style={{
                            textTransform: "capitalize",
                            color:
                              STATUS_COLORS[q.status] ?? "var(--color-text)",
                            fontWeight: 600,
                          }}
                        >
                          {t(`statuses.${q.status}`)}
                        </span>
                      </td>
                      <td
                        style={{
                          ...td,
                          textAlign: "right",
                          fontFamily: "var(--font-mono)",
                          color: "var(--color-text-strong)",
                        }}
                      >
                        {q.quote?.amountMinor != null
                          ? formatBDT(q.quote.amountMinor, l)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </Section>
    </>
  );
}

const emptyBox: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "var(--s-4)",
  padding: "var(--s-8)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-lg)",
  background: "var(--color-surface)",
};

const th: React.CSSProperties = {
  padding: "var(--s-4)",
  borderBottom: "1px solid var(--color-border)",
  fontSize: "var(--fs-caption)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--color-text-muted)",
  fontWeight: 600,
};

const td: React.CSSProperties = {
  padding: "var(--s-4)",
  borderBottom: "1px solid var(--color-border)",
  verticalAlign: "middle",
};
