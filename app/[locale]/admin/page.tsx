import { setRequestLocale, getTranslations } from "next-intl/server";

const KPIS = [
  "revenue",
  "orders",
  "lowStock",
  "enrollments",
  "inquiries",
] as const;

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "admin" });

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <h1
        style={{ fontSize: "var(--fs-h2)", color: "var(--color-text-strong)" }}
      >
        {t("dashboard")}
      </h1>
      <div
        className="equal-5col"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: "var(--s-4)",
        }}
      >
        {KPIS.map((k) => (
          <div
            key={k}
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: "var(--r-lg)",
              padding: "var(--s-5)",
              background: "var(--color-surface)",
              display: "grid",
              gap: 6,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--fs-caption)",
                color: "var(--color-text-muted)",
              }}
            >
              {t(`kpis.${k}`)}
            </span>
            <strong
              style={{
                fontSize: "var(--fs-h3)",
                color: "var(--color-text-strong)",
              }}
            >
              —
            </strong>
          </div>
        ))}
      </div>
      <p style={{ color: "var(--color-text-muted)" }}>{t("comingSoon")}</p>
    </div>
  );
}
