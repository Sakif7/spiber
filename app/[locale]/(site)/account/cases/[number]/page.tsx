import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect, notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { getSessionUser } from "@/lib/auth/current-user";
import { listMedicalCasesByUser } from "@/lib/repositories/medicalCases.repo";
import { formatBDT } from "@/lib/money";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

const card: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  borderRadius: "var(--r-lg)",
  padding: "var(--s-5)",
  display: "grid",
  gap: "var(--s-3)",
  maxWidth: 640,
};

export default async function AccountCaseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; number: string }>;
}) {
  const { locale, number } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "tourism" });
  const st = await getTranslations({
    locale,
    namespace: "tourism.status.case",
  });
  const cl = await getTranslations({ locale, namespace: "tourism.checklist" });

  const user = await getSessionUser();
  if (!user)
    redirect(`/${locale}?auth=login&next=/${locale}/account/cases/${number}`);

  // Ownership-guaranteed: only the user's own cases (documents never exposed).
  const mine = await listMedicalCasesByUser(user.sub).catch(() => []);
  const c = mine.find((x) => x.caseNumber === number);
  if (!c) notFound();

  return (
    <>
      <PageHeader
        title={c.caseNumber}
        breadcrumbs={[
          { label: "Account", href: "/account" },
          { label: t("account.title"), href: "/account/cases" },
          { label: c.caseNumber },
        ]}
      />
      <Section py="clamp(48px, 6vw, 80px)">
        <Container style={{ display: "grid", gap: "var(--s-5)" }}>
          <div style={card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <strong style={{ color: "var(--color-text-strong)" }}>
                {t("lookup.statusLabel")}
              </strong>
              <span
                style={{
                  padding: "4px 12px",
                  borderRadius: "var(--r-pill)",
                  background: "var(--color-secondary-soft)",
                  color: "var(--color-text-strong)",
                  fontWeight: 600,
                  fontSize: "var(--fs-caption)",
                }}
              >
                {st(c.status)}
              </span>
            </div>
            {c.requestedService && (
              <span
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: "var(--fs-body-sm)",
                }}
              >
                {c.requestedService}
              </span>
            )}
          </div>

          {c.quotation?.amountMinor != null && (
            <div style={card}>
              <strong style={{ color: "var(--color-text-strong)" }}>
                {t("lookup.quotation")}
              </strong>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-text-muted)" }}>
                  {t("package.estimatedCost")}
                </span>
                <strong>{formatBDT(c.quotation.amountMinor, l)}</strong>
              </div>
              {c.quotation.notes && (
                <p style={{ margin: 0 }}>{c.quotation.notes}</p>
              )}
              <span
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: "var(--fs-caption)",
                }}
              >
                {t("cost.estimate")}
              </span>
            </div>
          )}

          <div style={card}>
            <strong style={{ color: "var(--color-text-strong)" }}>
              {t("lookup.checklist")}
            </strong>
            {(
              [
                "appointment",
                "visa",
                "airTicket",
                "accommodation",
                "airportTransfer",
              ] as const
            ).map((k) => {
              const item = c.arrangementChecklist?.[k];
              return (
                <div
                  key={k}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "var(--fs-body-sm)",
                  }}
                >
                  <span>{cl(k)}</span>
                  <span
                    style={{
                      color: item?.done
                        ? "var(--color-success)"
                        : "var(--color-text-muted)",
                    }}
                  >
                    {item?.done ? cl("done") : cl("pending")}
                  </span>
                </div>
              );
            })}
          </div>
        </Container>
      </Section>
    </>
  );
}
