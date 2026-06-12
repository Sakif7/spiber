import { Link } from "@/i18n/navigation";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { StatusBadge } from "@/components/admin/ui/status-badge";

export type CatalogRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
};

/** Standard tourism-catalog table: name (link) · slug · status. */
export function CatalogTable({
  rows,
  base,
  empty,
}: {
  rows: CatalogRow[];
  base: string;
  empty: string;
}) {
  const columns: Column<CatalogRow>[] = [
    {
      key: "title",
      header: "Name",
      cell: (r) => (
        <Link
          href={`${base}/${r.id}`}
          className="text-primary font-medium hover:underline"
        >
          {r.title || "(untitled)"}
        </Link>
      ),
    },
    {
      key: "slug",
      header: "Slug",
      cell: (r) => (
        <span className="text-muted-foreground font-mono text-xs">
          {r.slug}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "right",
      cell: (r) => <StatusBadge>{r.status}</StatusBadge>,
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.id}
      empty={empty}
      minWidth={520}
    />
  );
}
