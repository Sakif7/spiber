import { setRequestLocale } from "next-intl/server";
import { MaintenancePanel } from "@/components/admin/maintenance-panel";
import { countDeletable } from "@/lib/services/hard-delete.service";

export const dynamic = "force-dynamic";

export default async function AdminMaintenancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let collections: Awaited<ReturnType<typeof countDeletable>> = [];
  try {
    collections = await countDeletable();
  } catch {
    collections = [];
  }

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <div style={{ display: "grid", gap: "var(--s-2)" }}>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-2xl)",
            color: "var(--color-text-strong)",
          }}
        >
          Maintenance
        </h1>
        <p
          style={{
            margin: 0,
            color: "var(--color-text-muted)",
            maxWidth: "70ch",
          }}
        >
          Permanently delete records to clean up test data. Everywhere else the
          app uses recoverable soft-delete — actions here are{" "}
          <strong style={{ color: "var(--color-error)" }}>irreversible</strong>.
          Expand a collection to browse and delete individual records, or purge
          a whole collection (type its name to confirm).
        </p>
      </div>

      <div
        style={{
          display: "flex",
          gap: "var(--s-3)",
          alignItems: "flex-start",
          padding: "var(--s-4)",
          border: "1px solid var(--color-error)",
          borderRadius: "var(--r-lg)",
          background: "color-mix(in srgb, var(--color-error) 6%, transparent)",
        }}
      >
        <span aria-hidden style={{ fontSize: 18 }}>
          ⚠️
        </span>
        <div
          style={{ fontSize: "var(--fs-body-sm)", color: "var(--color-text)" }}
        >
          <strong>Danger zone.</strong> Deletes are not cascaded — removing a
          product won’t remove its orders/reviews/inventory movements.
          Hard-delete those collections too if you’re cleaning a full test
          scenario. User accounts and audit logs are protected here; use{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>
            npm run reset-seed
          </code>{" "}
          for a full wipe.
        </div>
      </div>

      <div style={{ display: "grid", gap: "var(--s-3)" }}>
        {collections.map((c) => (
          <MaintenancePanel
            key={c.name}
            name={c.name}
            label={c.label}
            softDelete={c.softDelete}
            initialCount={c.count}
          />
        ))}
      </div>
    </div>
  );
}
