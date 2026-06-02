import { setRequestLocale, getTranslations } from "next-intl/server";
import { revenueSince } from "@/lib/repositories/orders.repo";
import { lowStockProducts } from "@/lib/repositories/products.repo";
import { formatBDT } from "@/lib/money";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "admin" });

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  let revenueMinor = 0;
  let orderCount = 0;
  let lowStock = 0;
  try {
    const [rev, low] = await Promise.all([
      revenueSince(dayStart),
      lowStockProducts(),
    ]);
    revenueMinor = rev.revenueMinor;
    orderCount = rev.count;
    lowStock = low.length;
  } catch (e) {
    logger.warn("dashboard KPI load failed", e);
  }

  const kpis: { key: string; value: string }[] = [
    { key: "revenue", value: formatBDT(revenueMinor, "en") },
    { key: "orders", value: String(orderCount) },
    { key: "lowStock", value: String(lowStock) },
    { key: "inquiries", value: "—" },
  ];

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <h1
        style={{ fontSize: "var(--fs-h2)", color: "var(--color-text-strong)" }}
      >
        {t("dashboard")}
      </h1>
      <div
        className="equal-4col"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "var(--s-4)",
        }}
      >
        {kpis.map((k) => (
          <div
            key={k.key}
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
              {t(`kpis.${k.key}`)}
            </span>
            <strong
              style={{
                fontSize: "var(--fs-h3)",
                color: "var(--color-text-strong)",
              }}
            >
              {k.value}
            </strong>
          </div>
        ))}
      </div>
      <p style={{ color: "var(--color-text-muted)" }}>{t("comingSoon")}</p>
    </div>
  );
}
