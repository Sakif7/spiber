import { ShieldAlert } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { AdminPageHeader } from "@/components/admin/ui/page-header";

/**
 * People — employees, visits, expenses, payroll, payouts — is super-admin
 * only: it is every director's pay. The APIs behind it already refuse anyone
 * else; this shows the refusal to an admin who opens a URL the sidebar never
 * showed them. It cannot keep the data out on its own: Next renders each page
 * alongside this layout and ships the page's payload even when `children` is
 * withheld, so every page checks again before it loads anything.
 * Re-validated against the database, like the APIs, so a demoted account
 * cannot ride a live token.
 */
export default async function PeopleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireSuperAdmin();
  if (!admin) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="People" />
        <div className="bg-card flex items-start gap-3 rounded-lg border p-4">
          <ShieldAlert className="text-destructive mt-0.5 size-5 shrink-0" />
          <p className="text-sm">
            People and pay are restricted to <strong>super-admins</strong>. Use
            the sidebar for the pages you have access to.
          </p>
        </div>
      </div>
    );
  }
  return children;
}
