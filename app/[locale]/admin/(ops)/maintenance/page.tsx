import { setRequestLocale } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/current-user";
import { isSuperAdmin } from "@/lib/auth/rbac";
import { TriangleAlert } from "lucide-react";
import { MaintenancePanel } from "@/components/admin/maintenance-panel";
import { MaintenanceTabs } from "@/components/admin/maintenance-tabs";
import { countDeletable } from "@/lib/services/hard-delete.service";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { GuideBody } from "@/components/guide/guide-body";
import { ADMIN_GUIDE } from "@/lib/guide/admin-guide";

export const dynamic = "force-dynamic";

export default async function AdminMaintenancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Permanent deletion is super-admin only (the API enforces it too). A plain
  // admin gets the guide alone rather than a tab that would 403 on every click.
  const canCleanUp = isSuperAdmin(await getSessionUser());

  let collections: Awaited<ReturnType<typeof countDeletable>> = [];
  if (canCleanUp) {
    try {
      collections = await countDeletable();
    } catch {
      collections = [];
    }
  }

  const guide = (
    <div className="grid gap-4">
      <div>
        <h2 className="text-foreground text-lg font-bold tracking-tight">
          {ADMIN_GUIDE.title}
        </h2>
        <p className="text-muted-foreground mt-1">{ADMIN_GUIDE.lede}</p>
        {ADMIN_GUIDE.updated && (
          <p className="text-muted-foreground mt-1 text-xs">
            {ADMIN_GUIDE.updated}
          </p>
        )}
      </div>
      <GuideBody guide={ADMIN_GUIDE} imageBase="/guide/admin" tone="admin" />
    </div>
  );

  const cleanup = !canCleanUp ? null : (
    <div className="grid gap-4">
      <div className="border-destructive/50 bg-destructive/5 flex items-start gap-3 rounded-lg border p-4">
        <TriangleAlert
          aria-hidden
          className="text-destructive mt-0.5 size-4 shrink-0"
        />
        <div className="text-foreground">
          <strong className="font-medium">Danger zone.</strong> Everywhere else
          the app uses recoverable soft-delete. Deletes here are{" "}
          <strong className="text-destructive">irreversible</strong> and are not
          cascaded, so removing a product won’t remove its
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

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Maintenance"
        description="How to run the admin, and the tools for permanently clearing test data."
      />
      <MaintenanceTabs guide={guide} cleanup={cleanup} />
    </div>
  );
}
