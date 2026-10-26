import { ShieldAlert } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { AdminPageHeader } from "@/components/admin/ui/page-header";

/**
 * Sales — leads, orders, the report — is super-admin only: client pricing,
 * negotiation history and the company's revenue. The APIs behind it already
 * refuse anyone else; this keeps the pages themselves from rendering it for an
 * admin who opens a URL the sidebar never showed them. Re-validated against
 * the database, like the APIs.
 */
export default async function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireSuperAdmin();
  if (!admin) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Sales" />
        <div className="bg-card flex items-start gap-3 rounded-lg border p-4">
          <ShieldAlert className="text-destructive mt-0.5 size-5 shrink-0" />
          <p className="text-sm">
            Sales is restricted to <strong>super-admins</strong>. Use the
            sidebar for the pages you have access to.
          </p>
        </div>
      </div>
    );
  }
  return children;
}
