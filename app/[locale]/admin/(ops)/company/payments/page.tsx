import { setRequestLocale } from "next-intl/server";
import { AlertTriangle, Banknote, Hourglass, Receipt } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requireSuperAdmin } from "@/lib/auth/guard";
import {
  countAttemptsByStatus,
  listAttempts,
  paymentTotals,
  type LeanAttempt,
} from "@/lib/repositories/payment-attempts.repo";
import { getPaymentSettings } from "@/lib/services/payment-settings.service";
import { paymentProviderStatus } from "@/lib/payments";
import {
  ATTEMPT_STATUS_VIEW,
  PAYMENT_POINT_LABEL,
  paymentAttemptStatusEnum,
  paymentPointEnum,
  type PaymentAttemptStatus,
  type PaymentSubjectKind,
} from "@/lib/schemas/payment";
import { dayOf, dayStart, formatDay } from "@/lib/hr/cycles";
import { formatBDT } from "@/lib/money";
import {
  parseListQuery,
  type ListConfig,
  type SearchParamsInput,
} from "@/lib/admin/list-params";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatCard } from "@/components/admin/ui/stat-card";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { Pagination } from "@/components/admin/ui/pagination";
import { RowActions, type RowAction } from "@/components/admin/ui/row-actions";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import {
  CorrectFeeForm,
  RecordRefundForm,
} from "@/components/admin/payments/attempt-forms";

export const dynamic = "force-dynamic";

const LIST: ListConfig = {
  sortable: ["date"],
  defaultSort: "date",
  filters: ["status"],
};

/** Where the thing a payment paid for is opened in the admin. */
function subjectHref(kind: PaymentSubjectKind, id: string): string | null {
  switch (kind) {
    case "order":
    case "order_due":
      return `/admin/orders/${id}`;
    case "software":
      return `/admin/software-purchases/${id}`;
    case "enrollment":
      return `/admin/enrollments/${id}`;
    case "sales_order":
      return `/admin/company/sales/orders/${id}`;
    case "medical_case":
      return `/admin/tourism/cases/${id}`;
    case "travel_request":
      return `/admin/tourism/travel/${id}`;
    default:
      return null;
  }
}

const KIND_LABEL: Record<PaymentSubjectKind, string> = {
  order: "Order",
  order_due: "Order (paid later)",
  software: "Software",
  enrollment: "Course",
  sales_order: "Sales invoice",
  medical_case: "Medical case",
  travel_request: "Travel request",
};

const fmtWhen = (d: Date | string) =>
  new Date(d).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dhaka",
  });

/** Calendar month in Dhaka, as the books count it. */
function thisMonth(now = new Date()): {
  start: Date;
  end: Date;
  label: string;
} {
  const [y, m] = dayOf(now).split("-").map(Number) as [number, number];
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = dayStart(`${y}-${pad(m)}-01`);
  const end = dayStart(m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`);
  return {
    start,
    end,
    label: start.toLocaleString("en-GB", {
      month: "long",
      timeZone: "Asia/Dhaka",
    }),
  };
}

/**
 * Every try at the gateway: what was taken, by what, what it cost, and what
 * has to go back. The money's truth for reconciling against PayStation's
 * settlement statement and the bank.
 */
export default async function PaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Here too, not only in the layout: Next ships a page's payload even when
  // its layout shows the refusal instead.
  if (!(await requireSuperAdmin())) return null;

  const query = parseListQuery(await searchParams, LIST);
  const status = paymentAttemptStatusEnum.safeParse(query.filters.status)
    .success
    ? (query.filters.status as PaymentAttemptStatus)
    : null;
  const month = thisMonth();

  const [list, totals, counts, settings] = await Promise.all([
    listAttempts({
      status,
      q: query.q || null,
      page: query.page,
      pageSize: query.pageSize,
    }).catch(() => ({ rows: [] as LeanAttempt[], total: 0 })),
    paymentTotals(month.start, month.end),
    countAttemptsByStatus(),
    getPaymentSettings(),
  ]);
  const gateway = paymentProviderStatus();
  const pages = Math.max(1, Math.ceil(list.total / query.pageSize));
  const pointsOn = paymentPointEnum.options.filter((p) => settings.points[p]);
  const latestRates = settings.feeRates[settings.feeRates.length - 1] ?? null;

  const columns: Column<LeanAttempt>[] = [
    {
      key: "invoice",
      header: "Invoice",
      cell: (a) => (
        <span className="font-mono text-xs">
          {a.invoiceNumber}
          {a.mode !== "live" ? (
            <span className="text-muted-foreground ml-1.5 font-sans">
              ({a.mode})
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "date",
      header: "Started",
      cell: (a) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {fmtWhen(a.createdAt)}
        </span>
      ),
    },
    {
      key: "for",
      header: "For",
      cell: (a) => {
        const href = subjectHref(a.subject.kind, String(a.subject.id));
        const label = `${KIND_LABEL[a.subject.kind]} ${a.subject.ref}`;
        return href ? (
          <Link
            href={href}
            className="text-primary font-medium hover:underline"
          >
            {label}
          </Link>
        ) : (
          label
        );
      },
    },
    {
      key: "status",
      header: "Status",
      cell: (a) => (
        <StatusBadge tone={ATTEMPT_STATUS_VIEW[a.status].tone}>
          {ATTEMPT_STATUS_VIEW[a.status].label}
        </StatusBadge>
      ),
    },
    {
      key: "method",
      header: "Paid with",
      cell: (a) =>
        a.method ? (
          <span>
            {a.method}
            {a.trxId ? (
              <span className="text-muted-foreground block font-mono text-xs">
                {a.trxId}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      className: "font-mono whitespace-nowrap",
      cell: (a) => formatBDT(a.paidMinor ?? a.amountMinor, "en"),
    },
    {
      key: "fee",
      header: "Fee",
      align: "right",
      className: "font-mono whitespace-nowrap",
      cell: (a) =>
        a.feeMinor != null ? (
          <span title={a.feeCorrected ? "Corrected by hand" : undefined}>
            {formatBDT(a.feeMinor, "en")}
            {a.feeCorrected ? "*" : ""}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      mobile: "actions",
      className: "w-10",
      cell: (a) => {
        const id = String(a._id);
        const amount = formatBDT(a.paidMinor ?? a.amountMinor, "en");
        const href = subjectHref(a.subject.kind, String(a.subject.id));
        const actions: RowAction[] = [];
        if (href) actions.push({ label: "Open", href, icon: "view" });
        if (a.status === "needs_refund") {
          actions.push({
            label: "Record refund",
            panel: {
              title: "Record refund",
              description: `${a.invoiceNumber} · ${amount}`,
              content: <RecordRefundForm attemptId={id} amountLabel={amount} />,
            },
          });
        }
        if (["paid", "needs_refund", "refunded"].includes(a.status)) {
          actions.push({
            label: "Correct fee",
            icon: "edit",
            panel: {
              title: "Correct the fee",
              description: `${a.invoiceNumber} · ${amount}`,
              content: (
                <CorrectFeeForm attemptId={id} feeMinor={a.feeMinor ?? null} />
              ),
            },
          });
        }
        return (
          <RowActions
            label={`Actions for ${a.invoiceNumber}`}
            actions={actions}
          />
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Online payments"
        description="Every try at PayStation: what was taken, by what, what it cost, and what has to go back."
        action={
          <Link
            href="/admin/company/payments/settings"
            className="text-primary font-medium hover:underline"
          >
            Settings &amp; fee rates
          </Link>
        }
      />

      <SectionCard title="Gateway">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">Provider</dt>
          <dd className="m-0">
            {gateway.ok ? (
              <>
                <span className="font-medium capitalize">
                  {gateway.provider.name}
                </span>
                {gateway.provider.online
                  ? ` · ${gateway.provider.mode}`
                  : " · offline only"}
              </>
            ) : (
              <span className="text-destructive">{gateway.error}</span>
            )}
          </dd>
          <dt className="text-muted-foreground">Switched on</dt>
          <dd className="m-0">
            {pointsOn.length
              ? pointsOn.map((p) => PAYMENT_POINT_LABEL[p]).join(", ")
              : "Nothing yet — customers see no online payment."}
          </dd>
          <dt className="text-muted-foreground">Fee rates</dt>
          <dd className="m-0">
            {latestRates ? (
              `In force from ${formatDay(latestRates.from)}`
            ) : (
              <span className="text-destructive">
                None entered — payment points cannot be switched on until they
                are.
              </span>
            )}
          </dd>
        </dl>
      </SectionCard>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`Taken in ${month.label}`}
          value={formatBDT(totals.takenMinor, "en")}
          hint={`${totals.taken} payment${totals.taken === 1 ? "" : "s"}`}
          icon={Banknote}
        />
        <StatCard
          label={`Fees in ${month.label}`}
          value={formatBDT(totals.feeMinor, "en")}
          hint={
            totals.feeMissing
              ? `${totals.feeMissing} with no rate — correct them`
              : "Booked as a cost in the sales report"
          }
          icon={Receipt}
          tone={totals.feeMissing ? "warning" : undefined}
        />
        <StatCard
          label="Needs refund"
          value={formatBDT(totals.owedMinor, "en")}
          hint={`${totals.owed} payment${totals.owed === 1 ? "" : "s"} to return by hand`}
          icon={AlertTriangle}
          tone={totals.owed ? "danger" : undefined}
          href="/admin/company/payments?status=needs_refund"
        />
        <StatCard
          label="Waiting at the gateway"
          value={String(counts.open ?? 0)}
          hint="Asked about every 5 minutes for an hour, then hourly for a day"
          icon={Hourglass}
        />
      </div>

      <ListToolbar
        search={{ placeholder: "Search invoice, order # or transaction ID…" }}
        filters={[
          {
            param: "status",
            label: "Status",
            kind: "pills",
            options: paymentAttemptStatusEnum.options.map((s) => ({
              value: s,
              label: ATTEMPT_STATUS_VIEW[s].label,
            })),
          },
        ]}
        total={list.total}
        countLabel={`${list.total} payment${list.total === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={list.rows}
        getRowKey={(a) => String(a._id)}
        empty={
          query.q || status
            ? "No payments match these filters."
            : "No online payments yet."
        }
        emptyDescription={
          query.q || status
            ? "Try clearing the search or the status."
            : "Every try at PayStation appears here — from checkout, Pay again, and later from payment links."
        }
        minWidth={920}
      />

      <Pagination
        page={query.page}
        pages={pages}
        total={list.total}
        pageSize={query.pageSize}
        noun="payments"
      />
    </div>
  );
}
