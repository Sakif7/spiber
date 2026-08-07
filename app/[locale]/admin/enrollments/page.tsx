import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ManualEnrollForm } from "@/components/admin/academy/manual-enroll-form";
import { listEnrollments } from "@/lib/repositories/enrollments.repo";
import { listCourses } from "@/lib/repositories/courses.repo";
import { localize } from "@/lib/schemas/localized";
import { formatBDT } from "@/lib/money";
import type { EnrollmentStatus } from "@/lib/schemas/enrollment";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusFilterPills } from "@/components/admin/ui/status-filter";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

const STATUSES = ["all", "pending", "active", "cancelled", "refunded"] as const;

const VALID = new Set<EnrollmentStatus>([
  "pending",
  "active",
  "cancelled",
  "refunded",
]);

type Row = Awaited<ReturnType<typeof listEnrollments>>["items"][number];

export default async function AdminEnrollmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { status: raw } = await searchParams;
  const active =
    raw && VALID.has(raw as EnrollmentStatus)
      ? (raw as EnrollmentStatus)
      : undefined;

  let rows: Row[] = [];
  let courseTitles = new Map<string, string>();
  try {
    const [res, courses] = await Promise.all([
      listEnrollments({ status: active, pageSize: 100 }),
      listCourses({ pageSize: 200 }),
    ]);
    rows = res.items;
    courseTitles = new Map(
      courses.items.map((c) => [String(c._id), localize(c.title, "en")]),
    );
  } catch {
    rows = [];
  }

  const courseOptions = Array.from(courseTitles, ([id, title]) => ({
    id,
    title,
  }));

  const columns: Column<Row>[] = [
    {
      key: "ref",
      header: "Reference",
      cell: (e) => (
        <Link
          href={`/admin/enrollments/${String(e._id)}`}
          className="text-primary font-mono text-xs font-medium hover:underline"
        >
          {e.enrollmentNumber}
        </Link>
      ),
    },
    {
      key: "course",
      header: "Course",
      cell: (e) => courseTitles.get(String(e.courseId)) ?? "—",
    },
    { key: "student", header: "Student", cell: (e) => e.email },
    {
      key: "status",
      header: "Status",
      cell: (e) => <StatusBadge>{e.status}</StatusBadge>,
    },
    {
      key: "payment",
      header: "Payment",
      cell: (e) => (
        <span className="text-muted-foreground capitalize">
          {e.payment?.status ?? "—"}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      className: "font-mono font-medium whitespace-nowrap",
      cell: (e) => (e.totalMinor > 0 ? formatBDT(e.totalMinor, "en") : "Free"),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Enrollments"
        description="MedAcademy enrollments — payment status and student access."
      />

      <ManualEnrollForm courses={courseOptions} />

      <StatusFilterPills
        statuses={STATUSES}
        active={active ?? "all"}
        basePath="/admin/enrollments"
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(e) => String(e._id)}
        empty="No enrollments found."
        minWidth={720}
      />
    </div>
  );
}
