import { setRequestLocale } from "next-intl/server";
import { StatusRowActions } from "@/components/admin/status-row-actions";
import { listProvisioningTasks } from "@/lib/repositories/provisioning.repo";

export const dynamic = "force-dynamic";

export default async function AdminProvisioningPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Awaited<ReturnType<typeof listProvisioningTasks>> = [];
  try {
    rows = await listProvisioningTasks();
  } catch {
    rows = [];
  }

  const th: React.CSSProperties = {
    textAlign: "left",
    padding: "var(--s-3) var(--s-4)",
    fontFamily: "var(--font-mono)",
    fontSize: "var(--fs-caption)",
    color: "var(--color-text-muted)",
    fontWeight: 500,
    borderBottom: "1px solid var(--color-border)",
  };
  const td: React.CSSProperties = {
    padding: "var(--s-3) var(--s-4)",
    fontSize: "var(--fs-small)",
    color: "var(--color-text)",
    borderBottom: "1px solid var(--color-border)",
  };

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <h1
        style={{
          margin: 0,
          fontFamily: "var(--font-display)",
          fontSize: "var(--fs-2xl)",
          color: "var(--color-text-strong)",
        }}
      >
        Provisioning queue
      </h1>
      <p
        style={{
          margin: 0,
          color: "var(--color-text-muted)",
          fontSize: "var(--fs-body-sm)",
        }}
      >
        External-app activations (e.g. ZenHcare). Activate the user in the
        external app, then mark the task done here.
      </p>
      <section
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: "var(--r-lg)",
          background: "var(--color-surface)",
          overflow: "hidden",
        }}
      >
        {rows.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: "var(--s-6)",
              textAlign: "center",
              color: "var(--color-text-muted)",
            }}
          >
            No provisioning tasks.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>App</th>
                <th style={th}>User</th>
                <th style={th}>Status</th>
                <th style={th}>Created</th>
                <th style={{ ...th, textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((task) => (
                <tr key={String(task._id)}>
                  <td style={td}>{task.externalApp}</td>
                  <td style={td}>{task.email}</td>
                  <td style={td}>{task.status}</td>
                  <td style={td}>
                    {new Date(task.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    {task.status === "done" ? (
                      <span style={{ color: "var(--color-success)" }}>
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
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
