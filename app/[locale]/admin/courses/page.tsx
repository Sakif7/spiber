import { setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { listCourses } from "@/lib/repositories/courses.repo";
import { formatBDT } from "@/lib/money";
import { localize } from "@/lib/schemas/localized";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  title: string;
  level: string;
  priceMinor: number;
  lessons: number;
  status: string;
};

export default async function AdminCoursesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Row[] = [];
  try {
    const { items } = await listCourses({ pageSize: 60 });
    rows = items.map((c) => ({
      id: String(c._id),
      title: localize(c.title, "en"),
      level: c.level,
      priceMinor: c.priceMinor,
      lessons: c.modules.reduce((s, m) => s + m.lessons.length, 0),
      status: c.status,
    }));
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "title",
      header: "Title",
      cell: (c) => (
        <Link
          href={`/admin/courses/${c.id}`}
          className="text-primary font-medium hover:underline"
        >
          {c.title || "(untitled)"}
        </Link>
      ),
    },
    {
      key: "level",
      header: "Level",
      cell: (c) => (
        <span className="text-muted-foreground capitalize">{c.level}</span>
      ),
    },
    {
      key: "price",
      header: "Price",
      align: "right",
      cell: (c) => (c.priceMinor > 0 ? formatBDT(c.priceMinor, "en") : "Free"),
    },
    {
      key: "lessons",
      header: "Lessons",
      align: "right",
      cell: (c) => c.lessons,
    },
    {
      key: "status",
      header: "Status",
      cell: (c) => <StatusBadge>{c.status}</StatusBadge>,
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Courses"
        description="MedAcademy courses — content, pricing, and publish status."
        action={
          <Button asChild>
            <Link href="/admin/courses/new">
              <Plus className="size-4" />
              New course
            </Link>
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(c) => c.id}
        empty="No courses yet."
        minWidth={640}
      />
    </div>
  );
}
