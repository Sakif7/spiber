import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { CtaButton } from "@/components/ui/cta-button";
import { getSessionUser } from "@/lib/auth/current-user";
import { listMedicalCasesByUser } from "@/lib/repositories/medicalCases.repo";
import { bcp47 } from "@/lib/i18n/intl-locale";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

const th: React.CSSProperties = {
  padding: "var(--s-4)",
  borderBottom: "1px solid var(--color-border)",
  fontSize: "var(--fs-caption)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--color-text-muted)",
  fontWeight: 600,
  textAlign: "left",
};
const td: React.CSSProperties = {
  padding: "var(--s-4)",
  borderBottom: "1px solid var(--color-border)",
};

export default async function AccountCasesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "tourism.account" });
  const st = await getTranslations({
    locale,
    namespace: "tourism.status.case",
  });

  const user = await getSessionUser();
  if (!user) redirect(`/${locale}?auth=login&next=/${locale}/account/cases`);

  const rows = await listMedicalCasesByUser(user.sub).catch(() => []);

  return (
    <>
      <PageHeader
        title={t("title")}
        breadcrumbs={[
          { label: "Account", href: "/account" },
          { label: t("title") },
        ]}
      />
      <Section py="clamp(48px, 6vw, 80px)">
        <Container>
          {rows.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "var(--s-4)",
                padding: "var(--s-8)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--r-lg)",
                background: "var(--color-surface)",
              }}
            >
              <p style={{ color: "var(--color-text-muted)" }}>{t("empty")}</p>
              <CtaButton href="/tourism/request-consultation">
                {(await getTranslations({ locale, namespace: "tourism.hub" }))(
                  "startCase",
                )}
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
                  <tr>
                    <th style={th}>{t("reference")}</th>
                    <th style={th}>{t("submitted")}</th>
                    <th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.caseNumber}>
                      <td style={td}>
                        <Link
                          href={`/account/cases/${c.caseNumber}`}
                          style={{
                            fontFamily: "var(--font-mono)",
                            color: "var(--color-brand-deep)",
                            textDecoration: "none",
                            fontWeight: 600,
                          }}
                        >
                          {c.caseNumber}
                        </Link>
                      </td>
                      <td style={{ ...td, color: "var(--color-text-muted)" }}>
                        {new Intl.DateTimeFormat(bcp47(l), {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        }).format(new Date(c.createdAt))}
                      </td>
                      <td
                        style={{
                          ...td,
                          fontWeight: 600,
                          color:
                            "var(--color-secondary-deep, var(--color-text-strong))",
                        }}
                      >
                        {st(c.status)}
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
