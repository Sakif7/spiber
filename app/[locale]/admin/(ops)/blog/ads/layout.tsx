import { ShieldAlert } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { AdminPageHeader } from "@/components/admin/ui/page-header";

/**
 * Blog ads are super-admin only: the publisher ID decides who Google pays for
 * every ad on the site. The API refuses anyone else; this shows the refusal
 * to an admin who opens a URL the sidebar never showed them. The page checks
 * again: Next ships a page's payload even when its layout withholds it.
 */
export default async function BlogAdsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireSuperAdmin();
  if (!admin) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Ads" />
        <div className="bg-card flex items-start gap-3 rounded-lg border p-4">
          <ShieldAlert className="text-destructive mt-0.5 size-5 shrink-0" />
          <p className="text-sm">
            Ads are restricted to <strong>super-admins</strong>. Use the sidebar
            for the pages you have access to.
          </p>
        </div>
      </div>
    );
  }
  return children;
}
