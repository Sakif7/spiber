import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { SellerAdminActions } from "@/components/admin/seller-admin-actions";
import { getSellerById } from "@/lib/repositories/sellers.repo";
import { countSellerProducts } from "@/lib/repositories/products.repo";
import { sellerEarningsSummary } from "@/lib/repositories/seller-commissions.repo";
import { formatBDT } from "@/lib/money";
import { EditorHeader } from "@/components/admin/ui/form-shell";
import {
  DetailCard,
  DetailLayout,
  DetailMeta,
  DetailRow,
} from "@/components/admin/ui/detail";
import { StatusBadge } from "@/components/admin/ui/status-badge";

export const dynamic = "force-dynamic";

export default async function AdminSellerDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const s = await getSellerById(id).catch(() => null);
  if (!s) notFound();

  const sellerId = String(s._id);
  const [earnings, productCount] = await Promise.all([
    sellerEarningsSummary(sellerId).catch(() => ({
      accruedMinor: 0,
      paidMinor: 0,
    })),
    countSellerProducts(sellerId).catch(() => 0),
  ]);

  const bank = s.bankDetails;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <EditorHeader
          backHref="/admin/sellers"
          backLabel="Sellers"
          title={s.displayName}
          action={<StatusBadge>{s.status}</StatusBadge>}
        />
        <DetailMeta>{s.slug}</DetailMeta>
      </div>

      <DetailLayout
        aside={
          <SellerAdminActions
            sellerId={sellerId}
            status={s.status}
            commissionBp={s.commissionBp ?? null}
          />
        }
      >
        <DetailCard>
          <DetailRow label="Display name">{s.displayName}</DetailRow>
          <DetailRow label="Slug" mono>
            {s.slug}
          </DetailRow>
          <DetailRow label="Status">{s.status}</DetailRow>
          <DetailRow label="Commission">
            {s.commissionBp == null ? "Default" : `${s.commissionBp / 100}%`}
          </DetailRow>
          {s.bio && <DetailRow label="Bio">{s.bio}</DetailRow>}
        </DetailCard>

        <DetailCard title="Earnings">
          <DetailRow label="Accrued (unpaid)">
            {formatBDT(earnings.accruedMinor)}
          </DetailRow>
          <DetailRow label="Paid out">
            {formatBDT(earnings.paidMinor)}
          </DetailRow>
          <DetailRow label="Products">{String(productCount)}</DetailRow>
        </DetailCard>

        <DetailCard title="Bank details">
          {bank ? (
            <>
              {bank.accountName && (
                <DetailRow label="Account name">{bank.accountName}</DetailRow>
              )}
              {bank.bankName && (
                <DetailRow label="Bank">{bank.bankName}</DetailRow>
              )}
              {bank.accountNumber && (
                <DetailRow label="Account number" mono>
                  {bank.accountNumber}
                </DetailRow>
              )}
              {bank.branch && (
                <DetailRow label="Branch">{bank.branch}</DetailRow>
              )}
              {bank.routingNumber && (
                <DetailRow label="Routing number" mono>
                  {bank.routingNumber}
                </DetailRow>
              )}
              {bank.mobileWallet && (
                <DetailRow label="Mobile wallet" mono>
                  {bank.mobileWallet}
                </DetailRow>
              )}
            </>
          ) : (
            <p className="text-muted-foreground m-0">
              No bank details on file.
            </p>
          )}
        </DetailCard>
      </DetailLayout>
    </div>
  );
}
