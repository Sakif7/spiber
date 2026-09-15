import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { SalesLead, type ISalesLead } from "@/lib/models/salesLead";
import { SalesOrder, type ISalesOrder } from "@/lib/models/salesOrder";
import { Visit, type IVisit } from "@/lib/models/visit";
import { Expense, type IExpense } from "@/lib/models/expense";
import {
  PayrollRun,
  type IPayrollLine,
  type IPayrollRun,
} from "@/lib/models/payrollRun";
import { Mailbox } from "@/lib/models/mailbox";
import { AuthoredDocument } from "@/lib/models/authored-document";
import type { Lean } from "@/lib/models/_shared";
import type { EmployeeSession } from "@/lib/auth/guard";
import { paginate, type Paged } from "@/lib/repositories/list-query";
import { applyPartialSearch } from "@/lib/repositories/search-filter";
import { computeMonth } from "@/lib/services/hr/payroll.service";
import { monthOf, monthWindow, type PayrollMonth } from "@/lib/hr/months";
import { getMailStore } from "@/lib/mail/store";
import { logger } from "@/lib/log";

/**
 * The employee portal's reads. Every query here is scoped to the signed-in
 * person and nothing else — by their login for things assigned to a user, by
 * their Employee record for things that name an employee:
 *
 *   leads    assignedTo = me  OR  sourceEmployeeId = my employee
 *   orders   createdBy = me   OR  leadId ∈ my leads
 *   visits   attendees ∋ my employee
 *   claims   employeeId = my employee
 *   pay      my own line of each run, nothing else of the run
 *
 * A record that is not theirs reads as null, exactly like a missing one.
 */
type Q = { page?: number; pageSize?: number; search?: string; status?: string };

const oid = (s: unknown) => new mongoose.Types.ObjectId(String(s));

function ids(session: EmployeeSession) {
  return { me: oid(session.claims.sub), employee: oid(session.employee._id) };
}

// ───────────────────────────── leads ─────────────────────────────

function leadFilter(session: EmployeeSession): Record<string, unknown> {
  const { me, employee } = ids(session);
  return {
    deletedAt: null,
    $or: [{ assignedTo: me }, { sourceEmployeeId: employee }],
  };
}

export async function myLeads(
  session: EmployeeSession,
  q: Q = {},
): Promise<Paged<ISalesLead>> {
  await connectToDatabase();
  const filter = leadFilter(session);
  if (q.status && q.status !== "all") filter.status = q.status;
  applyPartialSearch(filter, q.search, [
    "organisation",
    "code",
    "contactName",
    "phone",
    "email",
  ]);
  return paginate<ISalesLead>(SalesLead, filter, {
    sort: { lastActivityAt: -1, createdAt: -1 },
    page: q.page,
    pageSize: q.pageSize,
  });
}

export async function myLead(
  session: EmployeeSession,
  id: string,
): Promise<Lean<ISalesLead> | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectToDatabase();
  return SalesLead.findOne({ _id: id, ...leadFilter(session) })
    .lean<Lean<ISalesLead>>()
    .exec();
}

async function myLeadIds(
  session: EmployeeSession,
): Promise<mongoose.Types.ObjectId[]> {
  await connectToDatabase();
  const rows = await SalesLead.find(leadFilter(session))
    .select("_id")
    .lean<{ _id: mongoose.Types.ObjectId }[]>()
    .exec();
  return rows.map((r) => r._id);
}

// ───────────────────────────── orders ─────────────────────────────

async function orderFilter(
  session: EmployeeSession,
): Promise<Record<string, unknown>> {
  const { me } = ids(session);
  const leads = await myLeadIds(session);
  return {
    deletedAt: null,
    $or: [{ createdBy: me }, { leadId: { $in: leads } }],
  };
}

export async function myOrders(
  session: EmployeeSession,
  q: Q = {},
): Promise<Paged<ISalesOrder>> {
  const filter = await orderFilter(session);
  if (q.status && q.status !== "all") filter.status = q.status;
  applyPartialSearch(filter, q.search, [
    "number",
    "invoiceNumber",
    "leadSnapshot.organisation",
    "leadSnapshot.code",
  ]);
  return paginate<ISalesOrder>(SalesOrder, filter, {
    sort: { createdAt: -1 },
    page: q.page,
    pageSize: q.pageSize,
  });
}

export async function myOrder(
  session: EmployeeSession,
  id: string,
): Promise<Lean<ISalesOrder> | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  const filter = await orderFilter(session);
  return SalesOrder.findOne({ _id: id, ...filter })
    .lean<Lean<ISalesOrder>>()
    .exec();
}

// ───────────────────────────── visits ─────────────────────────────

function visitFilter(session: EmployeeSession): Record<string, unknown> {
  return { deletedAt: null, attendees: ids(session).employee };
}

export async function myVisits(
  session: EmployeeSession,
  q: Q = {},
): Promise<Paged<IVisit>> {
  await connectToDatabase();
  const filter = visitFilter(session);
  applyPartialSearch(filter, q.search, [
    "purpose",
    "organisation",
    "location",
    "ref",
  ]);
  return paginate<IVisit>(Visit, filter, {
    sort: { visitedAt: -1 },
    page: q.page,
    pageSize: q.pageSize,
  });
}

export async function myVisit(
  session: EmployeeSession,
  id: string,
): Promise<Lean<IVisit> | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectToDatabase();
  return Visit.findOne({ _id: id, ...visitFilter(session) })
    .lean<Lean<IVisit>>()
    .exec();
}

/** Visits this person may attach a claim to: their own, newest first. */
export async function myVisitOptions(
  session: EmployeeSession,
  limit = 100,
): Promise<{ id: string; label: string }[]> {
  await connectToDatabase();
  const rows = await Visit.find(visitFilter(session))
    .sort({ visitedAt: -1 })
    .limit(limit)
    .select("_id ref purpose organisation visitedAt")
    .lean<
      Pick<
        Lean<IVisit>,
        "_id" | "ref" | "purpose" | "organisation" | "visitedAt"
      >[]
    >()
    .exec();
  return rows.map((v) => ({
    id: String(v._id),
    label: `${new Date(v.visitedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ${v.organisation ?? v.purpose}`,
  }));
}

// ───────────────────────────── claims ─────────────────────────────

function claimFilter(session: EmployeeSession): Record<string, unknown> {
  return { deletedAt: null, employeeId: ids(session).employee };
}

export async function myClaims(
  session: EmployeeSession,
  q: Q = {},
): Promise<Paged<IExpense>> {
  await connectToDatabase();
  const filter = claimFilter(session);
  if (q.status && q.status !== "all") filter.status = q.status;
  applyPartialSearch(filter, q.search, ["description", "ref"]);
  return paginate<IExpense>(Expense, filter, {
    sort: { spentAt: -1, createdAt: -1 },
    page: q.page,
    pageSize: q.pageSize,
  });
}

export async function myClaim(
  session: EmployeeSession,
  id: string,
): Promise<Lean<IExpense> | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectToDatabase();
  return Expense.findOne({ _id: id, ...claimFilter(session) })
    .lean<Lean<IExpense>>()
    .exec();
}

// ───────────────────────────── pay ─────────────────────────────

export type Payslip = {
  month: PayrollMonth;
  status: "approved" | "estimate";
  line: IPayrollLine;
  /** The pool the share was taken from, for context — never other lines. */
  poolShares: number | null;
  approvedAt: Date | null;
  reimbursementMinor: number;
};

/**
 * Approved months this person was paid in, newest first, plus the open
 * month as an estimate. Only their own line is ever read out of a run.
 */
export async function myPayslips(
  session: EmployeeSession,
  limit = 24,
): Promise<{ approved: Payslip[]; estimate: Payslip | null }> {
  await connectToDatabase();
  const { employee } = ids(session);
  const runs = await PayrollRun.find({
    status: "approved",
    "lines.employeeId": employee,
  })
    .sort({ month: -1 })
    .limit(limit)
    .lean<Lean<IPayrollRun>[]>()
    .exec();
  const approved: Payslip[] = [];
  for (const run of runs) {
    const line = run.lines.find(
      (l) => String(l.employeeId) === String(employee),
    );
    if (!line) continue;
    const reimb = (run.reimbursements ?? [])
      .filter((r) => String(r.employeeId) === String(employee))
      .reduce((n, r) => n + (r.amountMinor ?? 0), 0);
    approved.push({
      month: run.month as PayrollMonth,
      status: "approved",
      line,
      poolShares: run.pool?.totalShares ?? null,
      approvedAt: run.approvedAt ?? null,
      reimbursementMinor: reimb,
    });
  }
  // The open month: a best-effort estimate from the live figures.
  let estimate: Payslip | null = null;
  const month = monthOf(new Date());
  if (!approved.some((p) => p.month === month)) {
    const computed = await computeMonth(month).catch(() => null);
    if (computed && computed.ok) {
      const line = computed.data.lines.find(
        (l) => String(l.employeeId) === String(employee),
      );
      if (line) {
        const reimb = computed.data.reimbursements
          .filter((r) => String(r.employeeId) === String(employee))
          .reduce((n, r) => n + (r.amountMinor ?? 0), 0);
        estimate = {
          month,
          status: "estimate",
          line,
          poolShares: computed.data.pool.totalShares ?? null,
          approvedAt: null,
          reimbursementMinor: reimb,
        };
      }
    }
  }
  return { approved, estimate };
}

// ───────────────────────────── the desk ─────────────────────────────

export type DeskSummary = {
  unreadMail: number | null;
  openLeads: number;
  ordersInProgress: number;
  claimsPending: number;
  visitsThisMonth: number;
  /** Documents sent to me that I have not yet acknowledged or signed. */
  documentsPending: number;
  /** Drafts I was asked to review and have not finished. */
  reviewsPending: number;
};

export async function deskSummary(
  session: EmployeeSession,
): Promise<DeskSummary> {
  await connectToDatabase();
  const { employee } = ids(session);
  const { start, end } = monthWindow(monthOf(new Date()));
  const [
    openLeads,
    ordersInProgress,
    claimsPending,
    visitsThisMonth,
    documentsPending,
    reviewsPending,
  ] = await Promise.all([
    SalesLead.countDocuments({
      ...leadFilter(session),
      status: { $nin: ["won", "lost"] },
    }),
    orderFilter(session).then((f) =>
      SalesOrder.countDocuments({
        ...f,
        status: { $nin: ["delivered", "cancelled"] },
      }),
    ),
    Expense.countDocuments({ ...claimFilter(session), status: "submitted" }),
    Visit.countDocuments({
      deletedAt: null,
      attendees: employee,
      visitedAt: { $gte: start, $lt: end },
    }),
    AuthoredDocument.countDocuments({
      deletedAt: null,
      status: "sent",
      recipients: { $elemMatch: { employeeId: employee, status: "pending" } },
    }),
    AuthoredDocument.countDocuments({
      deletedAt: null,
      status: { $in: ["draft", "in_review"] },
      reviewers: {
        $elemMatch: { userId: session.claims.sub, status: "pending" },
      },
    }),
  ]);
  let unreadMail: number | null = null;
  const mailbox = await Mailbox.findOne({
    employeeId: employee,
    deletedAt: null,
    status: "active",
  })
    .select("address")
    .lean<{ address: string }>()
    .exec();
  if (mailbox) {
    try {
      const folders = await getMailStore().listFolders(mailbox.address);
      unreadMail = folders.find((f) => f.specialUse === "inbox")?.unseen ?? 0;
    } catch (e) {
      logger.warn("desk: unread count unavailable", { error: String(e) });
    }
  }
  return {
    unreadMail,
    openLeads,
    ordersInProgress,
    documentsPending,
    reviewsPending,
    claimsPending,
    visitsThisMonth,
  };
}
