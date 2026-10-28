import { ShieldAlert } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { AdminPageHeader } from "@/components/admin/ui/page-header";

/**
 * Online payments are super-admin only: the ledger carries every customer's
 * payments and the gateway's fees feed the profit split. The APIs refuse
 * anyone else; this shows the refusal to an admin who opens a URL the sidebar
 * never showed them. Each page checks again: Next ships a page's payload even
 * when its layout withholds it.
 */
export default async function PaymentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireSuperAdmin();
  if (!admin) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Online payments" />
        <div className="bg-card flex items-start gap-3 rounded-lg border p-4">
          <ShieldAlert className="text-destructive mt-0.5 size-5 shrink-0" />
          <p className="text-sm">
            Online payments are restricted to <strong>super-admins</strong>. An
            order&apos;s own payment card is on its order page.
          </p>
        </div>
      </div>
    );
  }
  return children;
}
