import { connectToDatabase } from "@/lib/db/connect";
import { SalesLead } from "@/lib/models/salesLead";
import { SalesOrder } from "@/lib/models/salesOrder";
import { Expense } from "@/lib/models/expense";
import { Visit } from "@/lib/models/visit";
import { Employee } from "@/lib/models/employee";
import { PayrollRun } from "@/lib/models/payrollRun";
import { AuthoredDocument } from "@/lib/models/authored-document";
import { salesReport, receivables } from "@/lib/repositories/sales-report.repo";
import { monthOf, monthWindow } from "@/lib/hr/months";
import { labelOfKey } from "@/lib/hr/cycles";
import { lastEndedProfitPeriod } from "./hr/payroll.service";
import { payoutsDueCount } from "./hr/payout.service";
import type { SalesLeadStatus } from "@/lib/schemas/sales-lead";
import { vaultSummary, type VaultSummary } from "./company-fs.service";
import { logger } from "@/lib/log";

/**
 * The Company dashboard: the company side of the business at a glance —
 * sales, money owed, people, paperwork. Every figure comes from the same
 * queries the pages behind the links use (the sales report for money,
 * the vault's own usage roll-up), so the tile and the page never disagree.
 * Each block loads on its own and fails on its own: a slow vault never
 * blanks the sales tiles.
 */
export type CompanyDashboardData = {
  /** "2026-09" — the Dhaka calendar month the money figures cover. */
  month: string;
  sales: { revenueMinor: number; netCashMinor: number; orders: number } | null;
  receivables: { count: number; outstandingMinor: number };
  leads: {
    open: number;
    wonThisMonth: number;
    byStatus: { status: SalesLeadStatus; count: number }[];
  };
  orders: { inProgress: number; toDeliver: number; returned: number };
  claims: { pending: number; pendingMinor: number };
  people: { active: number; directors: number; visitsThisMonth: number };
  /**
   * The newest profit period that has ended, and whether it has been
   * approved — a period nobody has opened has no run, and counts as waiting.
   */
  payroll: { key: string; label: string; status: "draft" | "approved" } | null;
  /** People owed money for a pay period that has already ended. */
  payoutsDue: number;
  vault: VaultSummary | null;
  documents: {
    drafts: number;
    recent: {
      id: string;
      title: string;
      number: string | null;
      type: string;
      status: string;
      updatedAt: string;
    }[];
  };
};

const OPEN_LEAD: SalesLeadStatus[] = [
  "new",
  "contacted",
  "proposal_sent",
  "negotiating",
];
const LEAD_ORDER: SalesLeadStatus[] = [
  "new",
  "contacted",
  "proposal_sent",
  "negotiating",
  "won",
  "lost",
];

async function safely<T>(
  label: string,
  p: Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await p;
  } catch (e) {
    logger.warn(`company dashboard: ${label} failed`, { error: String(e) });
    return fallback;
  }
}

export async function loadCompanyDashboard(
  now = new Date(),
): Promise<CompanyDashboardData> {
  await connectToDatabase();
  const month = monthOf(now);
  const { start, end } = monthWindow(month);

  const [
    report,
    unpaid,
    leadRows,
    wonThisMonth,
    orderRows,
    claimRows,
    activeEmployees,
    directors,
    visitsThisMonth,
    payroll,
    payoutsDue,
    vault,
    drafts,
    recentDocs,
  ] = await Promise.all([
    safely("sales report", salesReport({ start, end }), null),
    safely("receivables", receivables(now), []),
    safely(
      "leads",
      SalesLead.aggregate<{ _id: SalesLeadStatus; count: number }>([
        { $match: { deletedAt: null } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]).exec(),
      [],
    ),
    safely(
      "leads won",
      SalesLead.countDocuments({
        deletedAt: null,
        status: "won",
        updatedAt: { $gte: start, $lt: end },
      }).exec(),
      0,
    ),
    safely(
      "orders",
      SalesOrder.aggregate<{ _id: string; count: number }>([
        { $match: { deletedAt: null } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]).exec(),
      [],
    ),
    safely(
      "claims",
      Expense.aggregate<{ _id: null; count: number; minor: number }>([
        { $match: { deletedAt: null, status: "submitted" } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            minor: { $sum: "$amountMinor" },
          },
        },
      ]).exec(),
      [],
    ),
    safely(
      "employees",
      Employee.countDocuments({ deletedAt: null, status: "active" }).exec(),
      0,
    ),
    safely(
      "directors",
      Employee.countDocuments({
        deletedAt: null,
        status: "active",
        kind: "director",
      }).exec(),
      0,
    ),
    safely(
      "visits",
      Visit.countDocuments({
        deletedAt: null,
        visitedAt: { $gte: start, $lt: end },
      }).exec(),
      0,
    ),
    safely(
      "payroll",
      lastEndedProfitPeriod(now).then(async (period) => {
        const run = await PayrollRun.findOne({ month: period.key })
          .select({ status: 1 })
          .lean<{ status: "draft" | "approved" } | null>()
          .exec();
        return {
          key: period.key,
          label: labelOfKey(period.key),
          status: run?.status ?? ("draft" as const),
        };
      }),
      null,
    ),
    safely("payouts due", payoutsDueCount(now), 0),
    safely("vault", vaultSummary(5), null),
    safely(
      "document drafts",
      AuthoredDocument.countDocuments({
        deletedAt: null,
        status: { $in: ["draft", "in_review"] },
      }).exec(),
      0,
    ),
    safely(
      "recent documents",
      AuthoredDocument.find({ deletedAt: null })
        .sort({ updatedAt: -1 })
        .limit(6)
        .select("title number type status updatedAt")
        .lean<
          {
            _id: unknown;
            title: string;
            number?: string | null;
            type: string;
            status: string;
            updatedAt: Date;
          }[]
        >()
        .exec(),
      [],
    ),
  ]);

  const leadCount = new Map(leadRows.map((r) => [r._id, r.count]));
  const orderCount = new Map(orderRows.map((r) => [r._id, r.count]));
  const claims = claimRows[0];

  return {
    month,
    sales: report
      ? {
          revenueMinor: report.totals.revenueMinor,
          netCashMinor: report.totals.netCashMinor,
          orders: report.totals.orders,
        }
      : null,
    receivables: {
      count: unpaid.length,
      outstandingMinor: unpaid.reduce((n, r) => n + r.outstandingMinor, 0),
    },
    leads: {
      open: OPEN_LEAD.reduce((n, s) => n + (leadCount.get(s) ?? 0), 0),
      wonThisMonth,
      byStatus: LEAD_ORDER.map((status) => ({
        status,
        count: leadCount.get(status) ?? 0,
      })),
    },
    orders: {
      inProgress:
        (orderCount.get("draft") ?? 0) +
        (orderCount.get("proposal_generated") ?? 0) +
        (orderCount.get("proposal_returned") ?? 0) +
        (orderCount.get("invoiced") ?? 0),
      toDeliver: orderCount.get("invoiced") ?? 0,
      returned: orderCount.get("proposal_returned") ?? 0,
    },
    claims: {
      pending: claims?.count ?? 0,
      pendingMinor: claims?.minor ?? 0,
    },
    people: { active: activeEmployees, directors, visitsThisMonth },
    payroll,
    payoutsDue,
    vault,
    documents: {
      drafts,
      recent: recentDocs.map((d) => ({
        id: String(d._id),
        title: d.title,
        number: d.number ?? null,
        type: d.type,
        status: d.status,
        updatedAt: d.updatedAt.toISOString(),
      })),
    },
  };
}
