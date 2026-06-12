import { setRequestLocale } from "next-intl/server";
import { StatusRowActions } from "@/components/admin/status-row-actions";
import { listLicenses } from "@/lib/repositories/licenses.repo";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof listLicenses>>[number];

export default async function AdminLicensesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Row[] = [];
  try {
    rows = await listLicenses();
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "key",
      header: "Key",
      cell: (lic) => (
        <span className="font-mono text-xs font-medium">{lic.key}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (lic) => <StatusBadge>{lic.status}</StatusBadge>,
    },
    {
      key: "issued",
      header: "Issued",
      cell: (lic) => (
        <span className="text-muted-foreground">
          {new Date(lic.issuedAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (lic) => (
        <StatusRowActions
          endpoint={`/api/admin/licenses/${String(lic._id)}`}
          actions={
            lic.status === "revoked"
              ? [{ to: "active", label: "Reactivate" }]
              : [{ to: "revoked", label: "Revoke", danger: true }]
          }
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Licenses"
        description="Issued software license keys — reactivate or revoke access."
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(lic) => String(lic._id)}
        empty="No licenses issued yet."
        minWidth={640}
      />
    </div>
  );
}
