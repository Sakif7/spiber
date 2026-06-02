import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { PurchaseActions } from "@/components/admin/purchase-actions";
import { getPurchaseById } from "@/lib/repositories/purchases.repo";
import { localize } from "@/lib/schemas/localized";
import { formatBDT } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminPurchaseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const doc = await getPurchaseById(id).catch(() => null);
  if (!doc) notFound();
  const p = doc.toObject();

  const card: React.CSSProperties = {
    border: "1px solid var(--color-border)",
    background: "var(--color-surface)",
    borderRadius: "var(--r-lg)",
    padding: "var(--s-5)",
    display: "grid",
    gap: "var(--s-3)",
  };
  const rowS: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    gap: "var(--s-4)",
  };
  const muted: React.CSSProperties = {
    color: "var(--color-text-muted)",
    fontSize: "var(--fs-body-sm)",
  };

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <h1
        style={{
          margin: 0,
          fontFamily: "var(--font-display)",
          fontSize: "var(--fs-2xl)",
          color: "var(--color-text-strong)",
        }}
      >
        {p.purchaseNumber}
      </h1>

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
            <Row
              label="Product"
              value={localize(p.productSnapshot.name, "en")}
            />
            <Row label="Email" value={p.email} />
            <Row label="Status" value={p.status} />
            <Row label="Payment" value={p.payment.status} />
            <Row label="Delivery" value={p.productSnapshot.deliveryType} />
            <Row label="Total" value={formatBDT(p.totalMinor, "en")} />
          </section>

          <section style={card}>
            <strong style={{ color: "var(--color-text-strong)" }}>
              Fulfillment
            </strong>
            <Row label="Status" value={p.fulfillment.status} />
            {p.fulfillment.licenseId && (
              <Row
                label="License"
                value={String(p.fulfillment.licenseId)}
                mono
              />
            )}
            {p.fulfillment.provisioningTaskId && (
              <Row
                label="Provisioning task"
                value={String(p.fulfillment.provisioningTaskId)}
                mono
              />
            )}
            {p.fulfillment.commissionId && (
              <Row
                label="Commission"
                value={String(p.fulfillment.commissionId)}
                mono
              />
            )}
          </section>

          <section style={card}>
            <strong style={{ color: "var(--color-text-strong)" }}>
              Timeline
            </strong>
            {p.timeline.map((tl, i) => (
              <div key={i} style={rowS}>
                <span>{tl.status}</span>
                <span style={muted}>
                  {new Date(tl.at).toLocaleString()}
                  {tl.note ? ` — ${tl.note}` : ""}
                </span>
              </div>
            ))}
          </section>
        </div>

        <PurchaseActions
          purchaseId={String(p._id)}
          status={p.status}
          fulfillmentStatus={p.fulfillment.status}
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
