import { setRequestLocale } from "next-intl/server";
import {
  Banknote,
  ShoppingBag,
  GraduationCap,
  ClipboardList,
  Boxes,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  loadDashboard,
  type DashboardData,
} from "@/lib/repositories/analytics.repo";
import { formatBDT } from "@/lib/money";
import { logger } from "@/lib/log";
import { cn } from "@/lib/cn";
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
//"Tourism pipeline" panel always reads as a funnel rather than a sparse chart.
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
    revenueOnlineMinor: 0,
    revenueManualMinor: 0,
    manualOrders: 0,
    orders: 0,
    ordersPrev: 0,
    enrollments: 0,
    enrollmentsPrev: 0,
    activeProducts: 0,
    openCases: 0,
    openInquiries: 0,
    pendingOrders: 0,
    openRefundRequests: 0,
    newQuotations: 0,
    pendingSellerProducts: 0,
    lowStock: 0,
  },
  revenueSeries: [],
  ordersByStatus: [],
  casesByStatus: [],
  activityMix: [],
  catalogByCategory: [],
  lowStockItems: [],
  recentOrders: [],
  recentCases: [],
};

const STORE_LABEL: Record<string, string> = {
  instruments: "Medtrade",
  marketplace: "Spiber Kart",
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

const listLink =
  "hover:bg-muted/60 -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors";

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
    label: s.replace(/_/g, ""),
    count: caseCounts.get(s) ?? 0,
  }));

  // Every row links to the list page filtered to exactly these records.
  const attention = [
    {
      label: "Pending orders",
      count: kpis.pendingOrders,
      href: "/admin/orders?status=pending",
    },
    {
      label: "Refund requests to settle",
      count: kpis.openRefundRequests,
      href: "/admin/orders",
    },
    {
      label: "New quotation requests",
      count: kpis.newQuotations,
      href: "/admin/quotations?status=new",
    },
    {
      label: "Seller products awaiting review",
      count: kpis.pendingSellerProducts,
      href: "/admin/sellers/products",
    },
    {
      label: "Low-stock products",
      count: kpis.lowStock,
      href: "/admin/inventory?level=low&sort=stock&dir=asc",
    },
    {
      label: "Open medical cases",
      count: kpis.openCases,
      href: "/admin/tourism/cases",
    },
  ];
  const attentionTotal = attention.reduce((n, a) => n + a.count, 0);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Dashboard"
        description="Live overview across commerce, academy, digihealth and tourism."
      />

      {/* KPI row */}
      <div className="grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          {
            label: "Revenue · 30d",
            value: formatBDT(kpis.revenueMinor, "en"),
            icon: Banknote,
            tone: "brand" as const,
            trend: trendOf(kpis.revenueMinor, kpis.revenuePrevMinor),
            // Say where the money came from: the sales team's offline orders
            // are counted here too, and that is not obvious from one figure.
            hint:
              kpis.manualOrders > 0
                ? `Incl. ${formatBDT(kpis.revenueManualMinor, "en")} from ${kpis.manualOrders} sales order${kpis.manualOrders === 1 ? "" : "s"}`
                : "Paid orders, last 30 days",
            href: "/admin/orders?status=paid",
          },
          {
            label: "Orders · 30d",
            value: String(kpis.orders),
            icon: ShoppingBag,
            tone: "info" as const,
            trend: trendOf(kpis.orders, kpis.ordersPrev),
            hint: `${kpis.pendingOrders} pending now`,
            href: "/admin/orders",
          },
          {
            label: "Enrollments · 30d",
            value: String(kpis.enrollments),
            icon: GraduationCap,
            tone: "success" as const,
            trend: trendOf(kpis.enrollments, kpis.enrollmentsPrev),
            hint: "New academy enrollments",
            href: "/admin/enrollments",
          },
          {
            label: "Open cases",
            value: String(kpis.openCases),
            icon: ClipboardList,
            tone: "warning" as const,
            hint: `${kpis.openInquiries} open inquiries`,
            href: "/admin/tourism/cases",
          },
          {
            label: "Low stock",
            value: String(kpis.lowStock),
            icon: Boxes,
            tone:
              kpis.lowStock > 0 ? ("danger" as const) : ("success" as const),
            hint:
              kpis.lowStock > 0
                ? "Tracked products at or below threshold"
                : "Every tracked product above threshold",
            href: "/admin/inventory?level=low&sort=stock&dir=asc",
          },
        ].map((k, i) => (
          <FadeIn key={k.label} delay={i * 0.04} className="h-full">
            <StatCard {...k} />
          </FadeIn>
        ))}
      </div>

      {/* Revenue trend + needs attention */}
      <div className="grid items-stretch gap-3 xl:grid-cols-3">
        <FadeIn delay={0.08} className="h-full xl:col-span-2">
          <SectionCard
            title="Revenue trend"
            description="Daily paid revenue over the last 30 days"
          >
            <RevenueChart data={data.revenueSeries} />
          </SectionCard>
        </FadeIn>
        <FadeIn delay={0.12} className="h-full">
          <SectionCard
            title="Needs attention"
            description={
              attentionTotal > 0
                ? `${attentionTotal} item${attentionTotal === 1 ? "" : "s"} waiting on an admin`
                : "Nothing is waiting on you"
            }
            bodyClassName="p-2"
          >
            <ul className="divide-border/60 divide-y">
              {attention.map((a) => (
                <li key={a.label}>
                  <Link
                    href={a.href}
                    className={cn(
                      listLink,
                      "mx-0 px-2",
                      a.count === 0 && "text-muted-foreground",
                    )}
                  >
                    <span className="">{a.label}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {a.count > 0 ? (
                        <StatusBadge tone="warning" dot={false}>
                          {String(a.count)}
                        </StatusBadge>
                      ) : (
                        <CheckCircle2
                          className="size-4 opacity-50"
                          aria-hidden
                        />
                      )}
                      <ChevronRight
                        className="text-muted-foreground size-3.5"
                        aria-hidden
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </SectionCard>
        </FadeIn>
      </div>

      {/* Activity + orders breakdown */}
      <div className="grid items-stretch gap-3 xl:grid-cols-3">
        <FadeIn delay={0.08} className="h-full xl:col-span-2">
          <SectionCard
            title="Business activity"
            description="New records per pipeline, last 30 days"
          >
            <ActivityChart data={data.activityMix} />
          </SectionCard>
        </FadeIn>
        <FadeIn delay={0.12} className="h-full">
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

      {/* Tourism pipeline + recent activity */}
      <div className="grid items-stretch gap-3 xl:grid-cols-3">
        <FadeIn delay={0.08} className="h-full">
          <SectionCard
            title="Tourism pipeline"
            description="Medical cases by stage"
          >
            <DistributionList data={caseFunnel} color="var(--chart-2)" />
          </SectionCard>
        </FadeIn>

        <FadeIn delay={0.12} className="h-full">
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
                    <Link href={`/admin/orders/${o.id}`} className={listLink}>
                      <span className="min-w-0">
                        <span className="text-foreground block truncate font-mono text-xs">
                          {o.orderNumber}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {o.email} · {fmtDate(o.createdAt)}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-foreground font-medium tabular-nums">
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

        <FadeIn delay={0.16} className="h-full">
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
                      className={listLink}
                    >
                      <span className="min-w-0">
                        <span className="text-foreground block truncate">
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

      {/* Catalog mix + low stock */}
      <div className="grid items-stretch gap-3 xl:grid-cols-2">
        <FadeIn delay={0.08} className="h-full">
          <SectionCard
            title="Catalog by category"
            description={`${kpis.activeProducts} active products`}
          >
            <HorizontalBars
              data={data.catalogByCategory}
              color="var(--chart-1)"
              height={260}
              emptyLabel="No products yet"
            />
          </SectionCard>
        </FadeIn>

        <FadeIn delay={0.12} className="h-full">
          <SectionCard
            title="Low stock"
            description="Tracked products at or below their threshold"
            action={
              <Link
                href="/admin/inventory?level=low&sort=stock&dir=asc"
                className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
              >
                Inventory <ArrowRight className="size-3" />
              </Link>
            }
          >
            {data.lowStockItems.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Nothing is running low"
                description="Every tracked product is above its low-stock threshold."
                className="py-8"
              />
            ) : (
              <ul className="divide-border/60 divide-y">
                {data.lowStockItems.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/admin/inventory?q=${encodeURIComponent(p.sku)}`}
                      className={listLink}
                    >
                      <span className="min-w-0">
                        <span className="text-foreground block truncate">
                          {p.name}
                        </span>
                        <span className="text-muted-foreground block truncate font-mono text-xs">
                          {p.sku} · {STORE_LABEL[p.storefront] ?? p.storefront}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 tabular-nums">
                        <span
                          className={cn(
                            "font-mono font-semibold",
                            p.stock <= 0
                              ? "text-destructive"
                              : "text-foreground",
                          )}
                        >
                          {p.stock}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          / low at {p.threshold}
                        </span>
                      </span>
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
