import { connectToDatabase } from "@/lib/db/connect";
import { revenueBetween, revenueByDay } from "@/lib/repositories/revenue.repo";
import { Order } from "@/lib/models/order";
import { Enrollment } from "@/lib/models/enrollment";
import { Product } from "@/lib/models/product";
import { MedicalCase } from "@/lib/models/medicalCase";
import { Quotation } from "@/lib/models/quotation";
import { SoftwarePurchase } from "@/lib/models/softwarePurchase";
import { Inquiry } from "@/lib/models/inquiry";
import { ContactMessage } from "@/lib/models/contact-message";
import { Appointment } from "@/lib/models/appointment";
import { TravelRequest } from "@/lib/models/travelRequest";
import {
  countLowStockProducts,
  listLowStockProducts,
  type LowStockRow,
} from "@/lib/repositories/products.repo";

const DAY = 86_400_000;

export type DashboardData = {
  kpis: {
    revenueMinor: number;
    revenuePrevMinor: number;
    /** Of `revenueMinor`, how much came from the website. */
    revenueOnlineMinor: number;
    /** …and how much from offline sales orders. */
    revenueManualMinor: number;
    /** Offline sales orders counted in the window. */
    manualOrders: number;
    orders: number;
    ordersPrev: number;
    enrollments: number;
    enrollmentsPrev: number;
    activeProducts: number;
    openCases: number;
    openInquiries: number;
    pendingOrders: number;
    /** Customer refund requests an admin still has to settle. */
    openRefundRequests: number;
    /** Quotation requests nobody has touched yet. */
    newQuotations: number;
    /** Seller listings (new or edited) waiting for approval. */
    pendingSellerProducts: number;
    /** Tracked products at or below their low-stock threshold. */
    lowStock: number;
  };
  revenueSeries: {
    day: string;
    revenueMinor: number;
    onlineMinor: number;
    manualMinor: number;
    orders: number;
  }[];
  ordersByStatus: { status: string; count: number }[];
  casesByStatus: { status: string; count: number }[];
  activityMix: { key: string; label: string; count: number }[];
  catalogByCategory: { name: string; count: number }[];
  lowStockItems: LowStockRow[];
  recentOrders: {
    id: string;
    orderNumber: string;
    email: string;
    totalMinor: number;
    status: string;
    storefront: string;
    createdAt: string;
  }[];
  recentCases: {
    id: string;
    caseNumber: string;
    patient: string;
    country: string;
    status: string;
    createdAt: string;
  }[];
};

/**
 * Revenue for a window. Delegates to the shared definition in revenue.repo so
 * the dashboard, the reports and payroll can never diverge — and so offline
 * sales orders are included everywhere at once.
 */
async function revenueInRange(start: Date, end: Date) {
  const r = await revenueBetween(start, end);
  return {
    revenueMinor: r.totalMinor,
    paidOrders: r.onlineCount + r.manualCount,
    onlineMinor: r.onlineMinor,
    manualMinor: r.manualMinor,
    manualOrders: r.manualCount,
  };
}

/**
 * Loads every dashboard metric in parallel from real collection data.
 * `now` is passed in (no Date.now in shared code paths). Windows are computed
 * in UTC so the daily aggregation buckets line up with the JS axis.
 */
export async function loadDashboard(now: Date): Promise<DashboardData> {
  await connectToDatabase();

  const todayUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const currentStart = new Date(todayUTC.getTime() - 29 * DAY); // 30 daily buckets incl. today
  const currentEnd = new Date(todayUTC.getTime() + DAY); // end of today
  const prevStart = new Date(currentStart.getTime() - 30 * DAY);

  const [
    revCurrent,
    revPrev,
    seriesRows,
    orders30,
    ordersPrev,
    enroll30,
    enrollPrev,
    activeProducts,
    openCases,
    openInquiries,
    pendingOrders,
    ordersByStatusRows,
    casesByStatusRows,
    catalogRows,
    recentOrderDocs,
    recentCaseDocs,
    mixCounts,
    attention,
    lowStockItems,
  ] = await Promise.all([
    revenueInRange(currentStart, currentEnd),
    revenueInRange(prevStart, currentStart),
    // Daily series from the shared revenue source, so the chart shows the
    // same money the KPI does — online and offline together.
    revenueByDay(currentStart, currentEnd),
    Order.countDocuments({
      createdAt: { $gte: currentStart, $lt: currentEnd },
    }),
    Order.countDocuments({ createdAt: { $gte: prevStart, $lt: currentStart } }),
    Enrollment.countDocuments({
      createdAt: { $gte: currentStart, $lt: currentEnd },
    }),
    Enrollment.countDocuments({
      createdAt: { $gte: prevStart, $lt: currentStart },
    }),
    Product.countDocuments({ status: "active", deletedAt: null }),
    MedicalCase.countDocuments({
      deletedAt: null,
      status: { $nin: ["closed", "lost"] },
    }),
    Inquiry.countDocuments({ status: { $nin: ["won", "lost"] } }),
    Order.countDocuments({ status: "pending" }),
    Order.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    MedicalCase.aggregate<{ _id: string; count: number }>([
      { $match: { deletedAt: null } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Product.aggregate<{ name: string; count: number }>([
      { $match: { deletedAt: null } },
      { $group: { _id: "$categoryId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "cat",
        },
      },
      {
        $project: {
          _id: 0,
          count: 1,
          name: {
            $ifNull: [{ $arrayElemAt: ["$cat.name.en", 0] }, "Uncategorised"],
          },
        },
      },
    ]),
    Order.find()
      .sort({ createdAt: -1 })
      .limit(6)
      .select("orderNumber email totalMinor status storefront createdAt")
      .lean()
      .exec(),
    MedicalCase.find({ deletedAt: null })
      .sort({ createdAt: -1 })
      .limit(6)
      .select("caseNumber patient status createdAt")
      .lean()
      .exec(),
    Promise.all([
      Order.countDocuments({ createdAt: { $gte: currentStart } }),
      Enrollment.countDocuments({ createdAt: { $gte: currentStart } }),
      SoftwarePurchase.countDocuments({ createdAt: { $gte: currentStart } }),
      Quotation.countDocuments({ createdAt: { $gte: currentStart } }),
      MedicalCase.countDocuments({ createdAt: { $gte: currentStart } }),
      Inquiry.countDocuments({ createdAt: { $gte: currentStart } }),
      Appointment.countDocuments({ createdAt: { $gte: currentStart } }),
      TravelRequest.countDocuments({ createdAt: { $gte: currentStart } }),
      ContactMessage.countDocuments({ createdAt: { $gte: currentStart } }),
    ]),
    // "Needs attention" counters — each is the exact predicate its list page
    // filters by, so the number on the dashboard equals the rows behind the link.
    Promise.all([
      Order.countDocuments({ "refundRequest.status": "open" }),
      Quotation.countDocuments({ deletedAt: null, status: "new" }),
      Product.countDocuments({
        deletedAt: null,
        $or: [{ approvalStatus: "pending" }, { pendingDraft: { $ne: null } }],
      }),
      countLowStockProducts(),
    ]),
    listLowStockProducts(6),
  ]);

  // revenueByDay already zero-fills every day in the window.
  const revenueSeries: DashboardData["revenueSeries"] = seriesRows;

  const [orderCt, enrollCt, swCt, quoteCt, caseCt, inqCt, aptCt, trvCt, msgCt] =
    mixCounts;
  const [openRefundRequests, newQuotations, pendingSellerProducts, lowStock] =
    attention;

  const activityMix = [
    { key: "orders", label: "Orders", count: orderCt },
    { key: "enrollments", label: "Enrollments", count: enrollCt },
    { key: "software", label: "Software", count: swCt },
    { key: "quotations", label: "Quotations", count: quoteCt },
    { key: "cases", label: "Med. cases", count: caseCt },
    { key: "inquiries", label: "Inquiries", count: inqCt },
    { key: "appointments", label: "Appointments", count: aptCt },
    { key: "travel", label: "Travel", count: trvCt },
    { key: "messages", label: "Messages", count: msgCt },
  ];

  return {
    kpis: {
      revenueMinor: revCurrent.revenueMinor,
      revenuePrevMinor: revPrev.revenueMinor,
      revenueOnlineMinor: revCurrent.onlineMinor,
      revenueManualMinor: revCurrent.manualMinor,
      manualOrders: revCurrent.manualOrders,
      orders: orders30,
      ordersPrev,
      enrollments: enroll30,
      enrollmentsPrev: enrollPrev,
      activeProducts,
      openCases,
      openInquiries,
      pendingOrders,
      openRefundRequests,
      newQuotations,
      pendingSellerProducts,
      lowStock,
    },
    revenueSeries,
    ordersByStatus: ordersByStatusRows.map((r) => ({
      status: r._id ?? "unknown",
      count: r.count,
    })),
    casesByStatus: casesByStatusRows.map((r) => ({
      status: r._id ?? "unknown",
      count: r.count,
    })),
    activityMix,
    catalogByCategory: catalogRows.map((r) => ({
      name: r.name,
      count: r.count,
    })),
    lowStockItems,
    recentOrders: recentOrderDocs.map((o) => ({
      id: String(o._id),
      orderNumber: o.orderNumber,
      email: o.email,
      totalMinor: o.totalMinor,
      status: o.status,
      storefront: o.storefront,
      createdAt: (o.createdAt as Date).toISOString(),
    })),
    recentCases: recentCaseDocs.map((c) => {
      const patient = (c as { patient?: { name?: string; country?: string } })
        .patient;
      return {
        id: String(c._id),
        caseNumber: c.caseNumber,
        patient: patient?.name ?? "—",
        country: patient?.country ?? "—",
        status: c.status,
        createdAt: (c.createdAt as Date).toISOString(),
      };
    }),
  };
}
