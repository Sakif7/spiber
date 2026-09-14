import { setRequestLocale } from "next-intl/server";
import { requireEmployee } from "@/lib/auth/guard";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { DetailCard } from "@/components/admin/ui/detail";
import { SignatureCard } from "@/components/admin/hr/signature-card";
import { NoEmployeeRecord } from "../_shared";

export const dynamic = "force-dynamic";

/**
 * The person's own signature: what gets placed into a document when they
 * acknowledge it. One image, replaceable, stored encrypted.
 */
export default async function MySignaturePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireEmployee();
  if (!session) return <NoEmployeeRecord title="My signature" />;
  const { employee } = session;
  const id = String(employee._id);

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="My signature"
        description="Used when you acknowledge a notice, letter or agreement sent to you. Upload a clear image, or draw it here."
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <SignatureCard
          endpoint="/api/admin/me/signature"
          imageSrc={`/api/media/signature/${id}`}
          initial={
            employee.signatureAssetId
              ? {
                  updatedAt: employee.signatureUpdatedAt
                    ? new Date(employee.signatureUpdatedAt).toISOString()
                    : null,
                }
              : null
          }
          self
        />
        <DetailCard title="How it is used">
          <ul className="text-muted-foreground list-disc space-y-1.5 pl-4 text-sm">
            <li>
              When the office sends you a document with a signature slot, you
              read it in <strong>My documents</strong> and acknowledge it by
              typing your name. Your signature is placed into the slot.
            </li>
            <li>
              A document you have already signed keeps the signature it was
              signed with, even if you replace this one later.
            </li>
            <li>
              A photo of your signature on white paper works; a transparent PNG
              looks best on the letterhead.
            </li>
          </ul>
        </DetailCard>
      </div>
    </div>
  );
}
