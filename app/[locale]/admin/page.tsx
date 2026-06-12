import { setRequestLocale } from "next-intl/server";
import {
  Banknote,
  ShoppingBag,
  GraduationCap,
  ClipboardList,
  ArrowRight,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  loadDashboard,
  type DashboardData,
} from "@/lib/repositories/analytics.repo";
import { formatBDT } from "@/lib/money";
import { logger } from "@/lib/log";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatCard, type StatTrend } from "@/components/admin/ui/stat-card";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { FadeIn } from "@/components/admin/ui/fade-in";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { RevenueChart } from "@/components/admin/dashboard/revenue-chart";
import { ActivityChart } from "@/components/admin/dashboard/activity-chart";
import { HorizontalBars } from "@/components/admin/dashboard/horizontal-bars";
import { StatusDonut } from "@/components/admin/dashboard/status-donut";
import { DistributionList } from "@/components/admin/dashboard/distribution-list";

export const dynamic = "force-dynamic";

// Full case funnel order — rendered even when a stage has zero cases, so the
// "Tourism pipeline" panel always reads as a funnel rather than a sparse chart.
const CASE_FUNNEL = [
  "new",
  "reviewing",
  "quoted",
  "confirmed",
  "arranging",
  "in_treatment",
  "follow_up",
  "closed",
  "lost",
] as const;

const EMPTY: DashboardData = {
  kpis: {
    revenueMinor: 0,
    revenuePrevMinor: 0,
    orders: 0,
    ordersPrev: 0,
    enrollments: 0,
    enrollmentsPrev: 0,
    activeProducts: 0,
    openCases: 0,
    openInquiries: 0,
    pendingOrders: 0,
  },
  revenueSeries: [],
  ordersByStatus: [],
  casesByStatus: [],
  activityMix: [],
  catalogByCategory: [],
  recentOrders: [],
  recentCases: [],
};

function trendOf(curr: number, prev: number): StatTrend | undefined {
  if (prev === 0) {
    if (curr === 0) return undefined;
    return { direction: "up", value: "new" };
  }
  const pct = Math.round(((curr - prev) / prev) * 100);
  return {
    direction: pct > 0 ? "up" : pct < 0 ? "down" : "flat",
    value: `${pct > 0 ? "+" : ""}${pct}%`,
  };
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let data = EMPTY;
  try {
    data = await loadDashboard(new Date());
  } catch (e) {
    logger.warn("dashboard load failed", e);
  }
  const { kpis } = data;

  const caseCounts = new Map(
    data.casesByStatus.map((c) => [c.status, c.count]),
  );
  const caseFunnel = CASE_FUNNEL.map((s) => ({
    label: s.replace(/_/g, " "),
    count: caseCounts.get(s) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Dashboard"
        description="Live overview across commerce, academy, digihealth and tourism."
      />

      {/* KPI row */}
      <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Revenue · 30d",
            value: formatBDT(kpis.revenueMinor, "en"),
            icon: Banknote,
            tone: "brand" as const,
            trend: trendOf(kpis.revenueMinor, kpis.revenuePrevMinor),
            hint: "Paid orders, last 30 days",
          },
          {
            label: "Orders · 30d",
            value: String(kpis.orders),
            icon: ShoppingBag,
            tone: "info" as const,
            trend: trendOf(kpis.orders, kpis.ordersPrev),
            hint: `${kpis.pendingOrders} pending now`,
          },
          {
            label: "Enrollments · 30d",
            value: String(kpis.enrollments),
            icon: GraduationCap,
            tone: "success" as const,
            trend: trendOf(kpis.enrollments, kpis.enrollmentsPrev),
            hint: "New academy enrollments",
          },
          {
            label: "Open cases",
            value: String(kpis.openCases),
            icon: ClipboardList,
            tone: "warning" as const,
            hint: `${kpis.openInquiries} open inquiries`,
          },
        ].map((k, i) => (
          <FadeIn key={k.label} delay={i * 0.05} className="h-full">
            <StatCard {...k} />
          </FadeIn>
        ))}
      </div>

      {/* Revenue trend + orders breakdown */}
      <div className="grid items-stretch gap-4 xl:grid-cols-3">
        <FadeIn delay={0.1} className="h-full xl:col-span-2">
          <SectionCard
            title="Revenue trend"
            description="Daily paid revenue over the last 30 days"
          >
            <RevenueChart data={data.revenueSeries} />
          </SectionCard>
        </FadeIn>
        <FadeIn delay={0.15} className="h-full">
          <SectionCard
            title="Orders by status"
            description={`${kpis.pendingOrders} pending`}
          >
            <StatusDonut
              data={data.ordersByStatus}
              emptyLabel="No orders yet"
            />
          </SectionCard>
        </FadeIn>
      </div>

      {/* Activity + tourism pipeline */}
      <div className="grid items-stretch gap-4 xl:grid-cols-3">
        <FadeIn delay={0.1} className="h-full xl:col-span-2">
          <SectionCard
            title="Business activity"
            description="New records per pipeline, last 30 days"
          >
            <ActivityChart data={data.activityMix} />
          </SectionCard>
        </FadeIn>
        <FadeIn delay={0.15} className="h-full">
          <SectionCard
            title="Tourism pipeline"
            description="Medical cases by stage"
          >
            <DistributionList data={caseFunnel} color="var(--chart-2)" />
          </SectionCard>
        </FadeIn>
      </div>

      {/* Catalog mix + recent activity */}
      <div className="grid items-stretch gap-4 xl:grid-cols-3">
        <FadeIn delay={0.1} className="h-full">
          <SectionCard
            title="Catalog by category"
            description={`${kpis.activeProducts} active products`}
          >
            <HorizontalBars
              data={data.catalogByCategory}
              color="var(--chart-1)"
              height={280}
              emptyLabel="No products yet"
            />
          </SectionCard>
        </FadeIn>

        <FadeIn delay={0.15} className="h-full">
          <SectionCard
            title="Recent orders"
            action={
              <Link
                href="/admin/orders"
                className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
              >
                View all <ArrowRight className="size-3" />
              </Link>
            }
          >
            {data.recentOrders.length === 0 ? (
              <EmptyState title="No orders yet" className="py-8" />
            ) : (
              <ul className="divide-border/60 divide-y">
                {data.recentOrders.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="hover:bg-muted/60 -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5 transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="text-foreground block truncate font-mono text-xs">
                          {o.orderNumber}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {o.email} · {fmtDate(o.createdAt)}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="text-foreground text-sm font-medium tabular-nums">
                          {formatBDT(o.totalMinor, "en")}
                        </span>
                        <StatusBadge dot={false}>{o.status}</StatusBadge>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </FadeIn>

        <FadeIn delay={0.2} className="h-full">
          <SectionCard
            title="Recent medical cases"
            action={
              <Link
                href="/admin/tourism/cases"
                className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
              >
                View all <ArrowRight className="size-3" />
              </Link>
            }
          >
            {data.recentCases.length === 0 ? (
              <EmptyState title="No cases yet" className="py-8" />
            ) : (
              <ul className="divide-border/60 divide-y">
                {data.recentCases.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/admin/tourism/cases/${c.id}`}
                      className="hover:bg-muted/60 -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5 transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="text-foreground block truncate text-sm">
                          {c.patient}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {c.caseNumber} · {c.country} · {fmtDate(c.createdAt)}
                        </span>
                      </span>
                      <StatusBadge dot={false}>{c.status}</StatusBadge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </FadeIn>
      </div>
    </div>
  );
}
