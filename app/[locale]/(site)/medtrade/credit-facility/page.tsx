import { setRequestLocale, getTranslations } from "next-intl/server";
import { CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { CtaButton } from "@/components/ui/cta-button";
import { CreditApplyForm } from "@/components/shop/credit-apply-form";
import { getSessionUser } from "@/lib/auth/current-user";
import { findUserById } from "@/lib/repositories/users.repo";
import { getCreditAccountByUserId } from "@/lib/repositories/credit-accounts.repo";
import { getLatestCreditApplicationByUser } from "@/lib/repositories/credit-applications.repo";

export const dynamic = "force-dynamic";

/**
 * "Credit facility" landing + application. The panel is state-aware: signed
 * out → sign-in prompt; live account → status; open application → under review;
 * otherwise (including after a rejection) → the application form.
 */
export default async function CreditFacilityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "credit" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const session = await getSessionUser();
  const account = session
    ? await getCreditAccountByUserId(session.sub).catch(() => null)
    : null;
  const application =
    session && !account
      ? await getLatestCreditApplicationByUser(session.sub).catch(() => null)
      : null;
  const profile = session
    ? await findUserById(session.sub).catch(() => null)
    : null;

  const steps = [t("step1"), t("step2"), t("step3")];

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("lede")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("instruments"), href: "/medtrade" },
          { label: t("title") },
        ]}
      />
      <section style={{ paddingBlock: "clamp(40px, 5vw, 80px)" }}>
        <Container>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "var(--s-6)",
              alignItems: "start",
            }}
          >
            <div style={{ display: "grid", gap: "var(--s-4)" }}>
              <h2
                style={{
                  margin: 0,
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--fs-h4)",
                  color: "var(--color-text-strong)",
                }}
              >
                {t("howTitle")}
              </h2>
              <ol
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "grid",
                  gap: "var(--s-3)",
                }}
              >
                {steps.map((s, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                    }}
                  >
                    <CheckCircle2
                      size={18}
                      aria-hidden
                      style={{
                        color: "var(--color-brand)",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    />
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              {!session ? (
                <StatePanel title={t("loginPrompt")}>
                  <CtaButton href="/medtrade/credit-facility?auth=login">
                    {t("signIn")}
                  </CtaButton>
                </StatePanel>
              ) : account && account.status === "active" ? (
                <StatePanel
                  title={t("activeTitle")}
                  body={t("activeBody", { days: account.termsDays })}
                >
                  <CtaButton href="/medtrade">{t("shopMedtrade")}</CtaButton>
                </StatePanel>
              ) : account ? (
                <StatePanel
                  title={t("suspendedTitle")}
                  body={t("suspendedBody")}
                />
              ) : application &&
                (application.status === "new" ||
                  application.status === "reviewing") ? (
                <StatePanel
                  title={t("pendingTitle")}
                  body={t("pendingBody")}
                  ref_={`${t("reference")}: ${application.applicationNumber}`}
                />
              ) : (
                <div style={{ display: "grid", gap: "var(--s-3)" }}>
                  {application?.status === "rejected" ? (
                    <p
                      style={{
                        margin: 0,
                        fontSize: "var(--fs-body-sm)",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {t("rejectedNote")}
                    </p>
                  ) : null}
                  <CreditApplyForm
                    initial={{
                      contactName: profile?.name,
                      email: profile?.email,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

function StatePanel({
  title,
  body,
  ref_,
  children,
}: {
  title: string;
  body?: string;
  ref_?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: "var(--s-3)",
        padding: "var(--s-5)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--r-lg)",
        background: "var(--color-surface)",
        justifyItems: "start",
      }}
    >
      <strong style={{ fontSize: "var(--fs-h5)" }}>{title}</strong>
      {body ? (
        <p style={{ margin: 0, color: "var(--color-text-muted)" }}>{body}</p>
      ) : null}
      {ref_ ? (
        <p style={{ margin: 0, fontFamily: "var(--font-mono)" }}>{ref_}</p>
      ) : null}
      {children}
    </div>
  );
}
