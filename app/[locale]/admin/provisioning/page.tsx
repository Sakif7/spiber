import { setRequestLocale } from "next-intl/server";
import { StatusRowActions } from "@/components/admin/status-row-actions";
import { listProvisioningTasks } from "@/lib/repositories/provisioning.repo";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof listProvisioningTasks>>[number];

export default async function AdminProvisioningPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Row[] = [];
  try {
    rows = await listProvisioningTasks();
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    { key: "app", header: "App", cell: (task) => task.externalApp },
    {
      key: "user",
      header: "User",
      cell: (task) => (
        <span className="text-muted-foreground">{task.email}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (task) => <StatusBadge>{task.status}</StatusBadge>,
    },
    {
      key: "created",
      header: "Created",
      cell: (task) => (
        <span className="text-muted-foreground">
          {new Date(task.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (task) =>
        task.status === "done" ? (
          <span className="text-sm font-medium text-[var(--color-success)]">
            Done
          </span>
        ) : (
          <StatusRowActions
            endpoint={`/api/admin/provisioning/${String(task._id)}`}
            actions={[
              { to: "in_progress", label: "Start" },
              { to: "done", label: "Mark done" },
            ]}
          />
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Provisioning queue"
        description="External-app activations (e.g. ZenHcare). Activate the user in the external app, then mark the task done here."
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(task) => String(task._id)}
        empty="No provisioning tasks."
        minWidth={680}
      />
    </div>
  );
}
