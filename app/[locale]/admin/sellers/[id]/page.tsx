import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { SellerAdminActions } from "@/components/admin/seller-admin-actions";
import { getSellerById } from "@/lib/repositories/sellers.repo";
import { countSellerProducts } from "@/lib/repositories/products.repo";
import { sellerEarningsSummary } from "@/lib/repositories/seller-commissions.repo";
import { formatBDT } from "@/lib/money";

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

  const card: React.CSSProperties = {
    border: "1px solid var(--color-border)",
    background: "var(--color-surface)",
    borderRadius: "var(--r-lg)",
    padding: "var(--s-5)",
    display: "grid",
    gap: "var(--s-3)",
  };
  const muted: React.CSSProperties = {
    color: "var(--color-text-muted)",
    fontSize: "var(--fs-body-sm)",
  };

  const bank = s.bankDetails;

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <div style={{ display: "grid", gap: 4 }}>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-2xl)",
            color: "var(--color-text-strong)",
          }}
        >
          {s.displayName}
        </h1>
        <span style={{ ...muted, fontFamily: "var(--font-mono)" }}>
          {s.slug} · {s.status}
        </span>
      </div>

      <div
        className="equal-2col"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
          gap: "var(--s-5)",
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: "var(--s-5)" }}>
          <section style={card}>
            <Row label="Display name" value={s.displayName} />
            <Row label="Slug" value={s.slug} mono />
            <Row label="Status" value={s.status} />
            <Row
              label="Commission"
              value={
                s.commissionBp == null ? "Default" : `${s.commissionBp / 100}%`
              }
            />
            {s.bio && <Row label="Bio" value={s.bio} />}
          </section>

          <section style={card}>
            <strong style={{ color: "var(--color-text-strong)" }}>
              Earnings
            </strong>
            <Row
              label="Accrued (unpaid)"
              value={formatBDT(earnings.accruedMinor)}
            />
            <Row label="Paid out" value={formatBDT(earnings.paidMinor)} />
            <Row label="Products" value={String(productCount)} />
          </section>

          <section style={card}>
            <strong style={{ color: "var(--color-text-strong)" }}>
              Bank details
            </strong>
            {bank ? (
              <>
                {bank.accountName && (
                  <Row label="Account name" value={bank.accountName} />
                )}
                {bank.bankName && <Row label="Bank" value={bank.bankName} />}
                {bank.accountNumber && (
                  <Row label="Account number" value={bank.accountNumber} mono />
                )}
                {bank.branch && <Row label="Branch" value={bank.branch} />}
                {bank.routingNumber && (
                  <Row label="Routing number" value={bank.routingNumber} mono />
                )}
                {bank.mobileWallet && (
                  <Row label="Mobile wallet" value={bank.mobileWallet} mono />
                )}
              </>
            ) : (
              <p style={{ margin: 0, ...muted }}>No bank details on file.</p>
            )}
          </section>
        </div>

        <SellerAdminActions
          sellerId={sellerId}
          status={s.status}
          commissionBp={s.commissionBp ?? null}
        />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "var(--s-4)",
      }}
    >
      <span
        style={{
          color: "var(--color-text-muted)",
          fontSize: "var(--fs-body-sm)",
        }}
      >
        {label}
      </span>
      <strong
        style={{
          color: "var(--color-text-strong)",
          fontFamily: mono ? "var(--font-mono)" : "inherit",
          wordBreak: "break-all",
          textAlign: "right",
        }}
      >
        {value}
      </strong>
    </div>
  );
}
