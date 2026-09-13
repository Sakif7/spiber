import { setRequestLocale } from "next-intl/server";
import {
  availableEarningsBySeller,
  availableCommissionsForSeller,
} from "@/lib/repositories/seller-commissions.repo";
import { listSellerPayouts } from "@/lib/repositories/seller-payouts.repo";
import { sellerNamesByIds } from "@/lib/repositories/sellers.repo";
import { formatBDT } from "@/lib/money";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { PayoutManager } from "@/components/admin/payout-manager";

export const dynamic = "force-dynamic";

export default async function AdminSellerPayoutsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let available: Awaited<ReturnType<typeof availableEarningsBySeller>> = [];
  let payoutDocs: Awaited<ReturnType<typeof listSellerPayouts>> = [];
  try {
    available = await availableEarningsBySeller();
  } catch {
    available = [];
  }
  try {
    payoutDocs = await listSellerPayouts();
  } catch {
    payoutDocs = [];
  }

  // Resolve commission ids per available seller (for the create-payout call).
  const availableWithCommissions = await Promise.all(
    available.map(async (a) => {
      const commissions = await availableCommissionsForSeller(a.sellerId).catch(
        () => [],
      );
      return {
        sellerId: a.sellerId,
        totalEarningsMinor: a.totalEarningsMinor,
        count: a.count,
        commissionIds: commissions.map((c) => String(c._id)),
      };
    }),
  );

  let names: Record<string, string> = {};
  try {
    names = await sellerNamesByIds([
      ...available.map((a) => a.sellerId),
      ...payoutDocs.map((p) => String(p.sellerId)),
    ]);
  } catch {
    names = {};
  }

  const availableProps = availableWithCommissions.map((a) => ({
    sellerId: a.sellerId,
    sellerName: names[a.sellerId] ?? "—",
    amountLabel: formatBDT(a.totalEarningsMinor),
    count: a.count,
    commissionIds: a.commissionIds,
  }));

  const payouts = payoutDocs.map((p) => ({
    id: String(p._id),
    payoutNumber: p.payoutNumber,
    sellerName: names[String(p.sellerId)] ?? "—",
    amountLabel: formatBDT(p.totalEarningsMinor),
    status: p.status,
  }));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Payouts"
        description="Settle accrued seller earnings and track payout history."
      />
      <PayoutManager available={availableProps} payouts={payouts} />
    </div>
  );
}
