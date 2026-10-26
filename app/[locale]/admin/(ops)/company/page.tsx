import { setRequestLocale } from "next-intl/server";
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  ChevronRight,
  FilePen,
  FolderLock,
  Receipt,
  ShieldAlert,
  Target,
  Users,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { isSuperAdmin } from "@/lib/auth/rbac";
import { formatBDT } from "@/lib/money";
import { cn } from "@/lib/cn";
import {
  DOCUMENT_STATUS_LABEL,
  DOCUMENT_TYPE_LABEL,
  type DocumentStatus,
  type DocumentType,
} from "@/lib/documents/types";
import { loadCompanyDashboard } from "@/lib/services/company-dashboard.service";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatCard } from "@/components/admin/ui/stat-card";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusBadge, statusTone } from "@/components/admin/ui/status-badge";
import { FadeIn } from "@/components/admin/ui/fade-in";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { DistributionList } from "@/components/admin/dashboard/distribution-list";

export const dynamic = "force-dynamic";

const LEAD_LABEL: Record<string, string> = {
  new: "new",
  contacted: "contacted",
  proposal_sent: "proposal sent",
  negotiating: "negotiating",
  won: "won",
  lost: "lost",
};

const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00+06:00`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  });

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

function bytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

const listLink =
  "hover:bg-muted/60 -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors";

export default async function CompanyDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getSessionUser();
  if (!isSuperAdmin(user)) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Company" />
        <div className="bg-card flex items-start gap-3 rounded-lg border p-4">
          <ShieldAlert className="text-destructive mt-0.5 size-5 shrink-0" />
          <p className="text-sm">
            The company dashboard is restricted to <strong>super-admins</strong>
            . Use the sidebar for the pages you have access to.
          </p>
        </div>
      </div>
    );
  }

  const data = await loadCompanyDashboard(new Date());
  const month = monthLabel(data.month);

  // Every row links to the list page filtered to exactly these records.
  const attention = [
    {
      label: "Expense claims to approve",
      count: data.claims.pending,
      href: "/admin/company/people/expenses?status=submitted",
    },
    {
      label: "Invoices not yet paid",
      count: data.receivables.count,
      href: "/admin/company/sales/orders?status=invoiced",
    },
    {
      label: "Invoiced orders to deliver",
      count: data.orders.toDeliver,
      href: "/admin/company/sales/orders?status=invoiced",
    },
    {
      label: "Proposals returned for changes",
      count: data.orders.returned,
      href: "/admin/company/sales/orders?status=proposal_returned",
    },
    {
      label: "Documents still in draft",
      count: data.documents.drafts,
      href: "/admin/company/documents?status=draft",
    },
    {
      label: data.payroll
        ? `Profit for ${data.payroll.label} awaiting approval`
        : "Profit period awaiting approval",
      count: data.payroll?.status === "draft" ? 1 : 0,
      href: data.payroll
        ? `/admin/company/people/payroll?period=${data.payroll.key}`
        : "/admin/company/people/payroll",
    },
    {
      label: "People owed a payout",
      count: data.payoutsDue,
      href: "/admin/company/people/payouts",
    },
  ];
  const attentionTotal = attention.reduce((n, a) => n + a.count, 0);

  const vaultPct = data.vault
    ? Math.min(
        100,
        Math.round(
          (data.vault.usedBytes / Math.max(1, data.vault.quotaBytes)) * 100,
        ),
      )
    : 0;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Company"
        description={`The company side at a glance — sales, money owed, people and paperwork for ${month}.`}
      />

      {/* KPI row */}
      <div className="grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          {
            label: "Cash after AIT · month",
            value: data.sales ? formatBDT(data.sales.netCashMinor, "en") : "—",
            icon: Banknote,
            tone: "brand" as const,
            hint: data.sales
              ? `${formatBDT(data.sales.revenueMinor, "en")} sold across ${data.sales.orders} order${data.sales.orders === 1 ? "" : "s"}`
              : "Sales report unavailable",
            href: "/admin/company/sales/report",
          },
          {
            label: "Outstanding",
            value: formatBDT(data.receivables.outstandingMinor, "en"),
            icon: Receipt,
            tone:
              data.receivables.count > 0
                ? ("warning" as const)
                : ("success" as const),
            hint:
              data.receivables.count > 0
                ? `${data.receivables.count} invoice${data.receivables.count === 1 ? "" : "s"} not yet paid`
                : "Every invoice is paid",
            href: "/admin/company/sales/orders?status=invoiced",
          },
          {
            label: "Open leads",
            value: String(data.leads.open),
            icon: Target,
            tone: "info" as const,
            hint: `${data.leads.wonThisMonth} won this month · ${data.orders.inProgress} order${data.orders.inProgress === 1 ? "" : "s"} in progress`,
            href: "/admin/company/sales/leads",
          },
          {
            label: "Claims to approve",
            value: String(data.claims.pending),
            icon: Users,
            tone:
              data.claims.pending > 0
                ? ("warning" as const)
                : ("success" as const),
            hint:
              data.claims.pending > 0
                ? `${formatBDT(data.claims.pendingMinor, "en")} waiting on you`
                : `${data.people.active} active employee${data.people.active === 1 ? "" : "s"}, ${data.people.visitsThisMonth} visit${data.people.visitsThisMonth === 1 ? "" : "s"} this month`,
            href: "/admin/company/people/expenses?status=submitted",
          },
          {
            label: "Vault",
            value: data.vault ? bytes(data.vault.usedBytes) : "—",
            icon: FolderLock,
            tone: "neutral" as const,
            hint: data.vault
              ? `${data.vault.files} file${data.vault.files === 1 ? "" : "s"} · ${vaultPct}% of ${bytes(data.vault.quotaBytes)}`
              : "Vault unavailable",
            href: "/admin/company/vault",
          },
        ].map((k, i) => (
          <FadeIn key={k.label} delay={i * 0.04} className="h-full">
            <StatCard {...k} />
          </FadeIn>
        ))}
      </div>

      {/* Needs attention + pipeline */}
      <div className="grid items-stretch gap-3 xl:grid-cols-3">
        <FadeIn delay={0.08} className="h-full xl:col-span-2">
          <SectionCard
            title="Needs attention"
            description={
              attentionTotal > 0
                ? `${attentionTotal} item${attentionTotal === 1 ? "" : "s"} waiting on you`
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
                    <span>{a.label}</span>
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
        <FadeIn delay={0.12} className="h-full">
          <SectionCard
            title="Sales pipeline"
            description="Every lead, by where it stands"
            action={
              <Link
                href="/admin/company/sales/leads"
                className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
              >
                Leads <ArrowRight className="size-3" />
              </Link>
            }
          >
            <DistributionList
              data={data.leads.byStatus.map((s) => ({
                label: LEAD_LABEL[s.status] ?? s.status,
                count: s.count,
              }))}
              color="var(--chart-2)"
              empty="No leads yet"
            />
          </SectionCard>
        </FadeIn>
      </div>

      {/* Paperwork */}
      <div className="grid items-stretch gap-3 xl:grid-cols-2">
        <FadeIn delay={0.08} className="h-full">
          <SectionCard
            title="Documents"
            description="Notices, letters, memos and agreements on the letterhead"
            action={
              <Link
                href="/admin/company/documents"
                className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
              >
                View all <ArrowRight className="size-3" />
              </Link>
            }
          >
            {data.documents.recent.length === 0 ? (
              <EmptyState
                icon={FilePen}
                title="Nothing written yet"
                description="Start a notice, letter, memo or agreement from Documents."
                className="py-8"
              />
            ) : (
              <ul className="divide-border/60 divide-y">
                {data.documents.recent.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/admin/company/documents/${d.id}`}
                      className={listLink}
                    >
                      <span className="min-w-0">
                        <span className="text-foreground block truncate">
                          {d.title}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {DOCUMENT_TYPE_LABEL[d.type as DocumentType] ??
                            d.type}
                          {" · "}
                          <span className="font-mono">
                            {d.number ?? "no number yet"}
                          </span>
                          {" · "}
                          {when(d.updatedAt)}
                        </span>
                      </span>
                      <StatusBadge tone={statusTone(d.status)} dot={false}>
                        {DOCUMENT_STATUS_LABEL[d.status as DocumentStatus] ??
                          d.status}
                      </StatusBadge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </FadeIn>

        <FadeIn delay={0.12} className="h-full">
          <SectionCard
            title="Vault"
            description={
              data.vault
                ? `${bytes(data.vault.usedBytes)} of ${bytes(data.vault.quotaBytes)} used · ${data.vault.files} file${data.vault.files === 1 ? "" : "s"}`
                : "Encrypted company files"
            }
            action={
              <Link
                href="/admin/company/vault"
                className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
              >
                Open vault <ArrowRight className="size-3" />
              </Link>
            }
          >
            {data.vault ? (
              <div className="space-y-3">
                <div
                  className="bg-muted h-2 overflow-hidden rounded-full"
                  role="progressbar"
                  aria-label="Vault space used"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={vaultPct}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${vaultPct}%`,
                      background:
                        vaultPct >= 90
                          ? "var(--destructive)"
                          : "var(--chart-1)",
                    }}
                  />
                </div>
                {data.vault.recent.length === 0 ? (
                  <EmptyState
                    icon={FolderLock}
                    title="The vault is empty"
                    description="Files you upload appear here, newest first."
                    className="py-6"
                  />
                ) : (
                  <ul className="divide-border/60 divide-y">
                    {data.vault.recent.map((f) => (
                      <li key={f.id}>
                        <Link
                          href={`/admin/company/vault?q=${encodeURIComponent(f.title)}&recursive=1`}
                          className={listLink}
                        >
                          <span className="min-w-0">
                            <span className="text-foreground block truncate">
                              {f.title}
                            </span>
                            <span className="text-muted-foreground block truncate text-xs">
                              {f.folder ?? "Root"} · {when(f.createdAt)}
                            </span>
                          </span>
                          <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
                            {bytes(f.size)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <EmptyState
                icon={ShieldAlert}
                title="Vault unavailable"
                description="The vault could not be read. Check that the vault key is configured."
                className="py-8"
              />
            )}
          </SectionCard>
        </FadeIn>
      </div>
    </div>
  );
}
