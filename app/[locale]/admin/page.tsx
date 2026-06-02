import { setRequestLocale, getTranslations } from "next-intl/server";
import {
  Banknote,
  ShoppingBag,
  AlertTriangle,
  MessageSquare,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";
import { revenueSince } from "@/lib/repositories/orders.repo";
import { lowStockProducts } from "@/lib/repositories/products.repo";
import { enrollmentStatsSince } from "@/lib/repositories/enrollments.repo";
import { countOpenInquiries } from "@/lib/repositories/inquiries.repo";
import { formatBDT } from "@/lib/money";
import { logger } from "@/lib/log";
import styles from "@/components/admin/admin.module.css";

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
  let newEnrollments = 0;
  let openInquiries = 0;
  try {
    const [rev, low, enr, inq] = await Promise.all([
      revenueSince(dayStart),
      lowStockProducts(),
      enrollmentStatsSince(dayStart),
      countOpenInquiries(),
    ]);
    revenueMinor = rev.revenueMinor;
    orderCount = rev.count;
    lowStock = low.length;
    newEnrollments = enr.count;
    openInquiries = inq;
  } catch (e) {
    logger.warn("dashboard KPI load failed", e);
  }

  const kpis: {
    key: string;
    value: string;
    icon: LucideIcon;
    tint: string;
    soft: string;
  }[] = [
    {
      key: "revenue",
      value: formatBDT(revenueMinor, "en"),
      icon: Banknote,
      tint: "var(--color-brand-deep)",
      soft: "var(--color-brand-soft)",
    },
    {
      key: "orders",
      value: String(orderCount),
      icon: ShoppingBag,
      tint: "var(--color-info)",
      soft: "var(--color-accent-soft)",
    },
    {
      key: "lowStock",
      value: String(lowStock),
      icon: AlertTriangle,
      tint: "var(--color-secondary-deep)",
      soft: "var(--color-secondary-soft)",
    },
    {
      key: "enrollments",
      value: String(newEnrollments),
      icon: GraduationCap,
      tint: "var(--color-secondary-deep)",
      soft: "var(--color-secondary-soft)",
    },
    {
      key: "inquiries",
      value: String(openInquiries),
      icon: MessageSquare,
      tint: "var(--color-text-subtle)",
      soft: "var(--color-surface-2)",
    },
  ];

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <div style={{ display: "grid", gap: 4 }}>
        <h1
          style={{
            fontSize: "var(--fs-h2)",
            color: "var(--color-text-strong)",
            margin: 0,
          }}
        >
          {t("dashboard")}
        </h1>
        <p
          style={{
            margin: 0,
            color: "var(--color-text-muted)",
            fontSize: "var(--fs-body-sm)",
          }}
        >
          Today at a glance.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "var(--s-4)",
        }}
      >
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.key} className={styles.kpi}>
              <span
                aria-hidden
                className={styles.kpiIcon}
                style={{ background: k.soft, color: k.tint }}
              >
                <Icon size={18} strokeWidth={2} />
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--fs-caption)",
                  textTransform: "uppercase",
                  letterSpacing: "var(--tracking-eyebrow)",
                  color: "var(--color-text-muted)",
                }}
              >
                {t(`kpis.${k.key}`)}
              </span>
              <strong
                style={{
                  fontSize: "var(--fs-h3)",
                  fontFamily: "var(--font-display)",
                  color: "var(--color-text-strong)",
                  lineHeight: 1.1,
                }}
              >
                {k.value}
              </strong>
            </div>
          );
        })}
      </div>
      <p style={{ color: "var(--color-text-muted)" }}>{t("comingSoon")}</p>
    </div>
  );
}
