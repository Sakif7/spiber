import { setRequestLocale } from "next-intl/server";
import { TriangleAlert } from "lucide-react";
import { MaintenancePanel } from "@/components/admin/maintenance-panel";
import { countDeletable } from "@/lib/services/hard-delete.service";
import { AdminPageHeader } from "@/components/admin/ui/page-header";

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
    <div className="space-y-4">
      <AdminPageHeader
        title="Maintenance"
        description={
          <>
            Permanently delete records to clean up test data. Everywhere else
            the app uses recoverable soft-delete — actions here are{" "}
            <strong className="text-destructive">irreversible</strong>. Expand a
            collection to browse and delete individual records, or purge a whole
            collection (type its name to confirm).
          </>
        }
      />

      <div className="border-destructive/50 bg-destructive/5 flex items-start gap-3 rounded-lg border p-4">
        <TriangleAlert
          aria-hidden
          className="text-destructive mt-0.5 size-4 shrink-0"
        />
        <div className="text-foreground text-[13px]">
          <strong className="font-medium">Danger zone.</strong> Deletes are not
          cascaded — removing a product won’t remove its
          orders/reviews/inventory movements. Hard-delete those collections too
          if you’re cleaning a full test scenario. User accounts and audit logs
          are protected here; use{" "}
          <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
            npm run reset-seed
          </code>{" "}
          for a full wipe.
        </div>
      </div>

      <div className="grid gap-3">
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
