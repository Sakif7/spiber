import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { MessageSquareQuote } from "lucide-react";
import { listTestimonialsForAdmin } from "@/lib/repositories/testimonials.repo";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  role: string;
  category: string;
  hasPhoto: boolean;
  order: number;
  published: boolean;
};

async function loadRows(): Promise<Row[]> {
  try {
    const docs = await listTestimonialsForAdmin();
    return docs.map((d) => ({
      id: String(d._id),
      name: d.name,
      role: d.role ?? "",
      category: d.category ?? "general",
      hasPhoto: Boolean(d.imageSrc),
      order: d.order ?? 0,
      published: d.published !== false,
    }));
  } catch {
    return [];
  }
}

export default async function AdminTestimonialsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const rows = await loadRows();

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Name",
      cell: (r) => (
        <Link
          href={`/admin/testimonials/${r.id}`}
          className="text-primary font-medium hover:underline"
        >
          {r.name}
        </Link>
      ),
    },
    {
      key: "role",
      header: "Role",
      cell: (r) =>
        r.role ? r.role : <span className="text-muted-foreground">—</span>,
    },
    {
      key: "category",
      header: "Section",
      cell: (r) => (
        <span className="text-muted-foreground">
          {r.category === "tourism" ? "Tourism" : "Homepage"}
        </span>
      ),
    },
    {
      key: "photo",
      header: "Photo",
      cell: (r) =>
        r.hasPhoto ? (
          <span className="text-[var(--color-success)]">✓</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "order",
      header: "Order",
      align: "right",
      className: "font-mono text-muted-foreground",
      cell: (r) => r.order,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <StatusBadge>{r.published ? "Published" : "Draft"}</StatusBadge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Testimonials"
        description="Patient and partner voices shown on the homepage and the tourism hub."
        action={
          <Button asChild>
            <Link href="/admin/testimonials/new">New testimonial</Link>
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        empty="No testimonials yet."
        emptyIcon={MessageSquareQuote}
        emptyDescription="Add a patient or partner testimonial to feature it on the site."
        minWidth={680}
      />
    </div>
  );
}
