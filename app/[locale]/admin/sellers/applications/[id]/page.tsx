import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { SellerApplicationActions } from "@/components/admin/seller-application-actions";
import { getSellerApplicationByIdLean } from "@/lib/repositories/seller-applications.repo";
import { getSessionUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function AdminSellerApplicationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const a = await getSellerApplicationByIdLean(id).catch(() => null);
  if (!a) notFound();
  const user = await getSessionUser();
  const assignedToMe = Boolean(
    user && a.assignedTo && String(a.assignedTo) === user.sub,
  );

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

  const bank = a.bankDetails;

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
          {a.businessName}
        </h1>
        <span style={{ ...muted, fontFamily: "var(--font-mono)" }}>
          {a.applicationNumber} · {a.status}
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
            <Row label="Business" value={a.businessName} />
            <Row label="Contact" value={a.contactName} />
            <Row label="Email" value={a.email} />
            {a.phone && <Row label="Phone" value={a.phone} />}
            {a.website && <Row label="Website" value={a.website} mono />}
            {a.address && <Row label="Address" value={a.address} />}
            {a.categories && <Row label="Categories" value={a.categories} />}
          </section>

          <section style={card}>
            <strong style={{ color: "var(--color-text-strong)" }}>
              Description
            </strong>
            <p
              style={{
                margin: 0,
                whiteSpace: "pre-line",
                color: "var(--color-text)",
              }}
            >
              {a.description}
            </p>
          </section>

          {bank && (
            <section style={card}>
              <strong style={{ color: "var(--color-text-strong)" }}>
                Bank details
              </strong>
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
            </section>
          )}

          {a.activity.length > 0 && (
            <section style={card}>
              <strong style={{ color: "var(--color-text-strong)" }}>
                Notes
              </strong>
              {a.activity.map((n, i) => (
                <div key={i} style={{ display: "grid", gap: 2 }}>
                  <span style={{ color: "var(--color-text)" }}>{n.body}</span>
                  <span style={muted}>{new Date(n.at).toLocaleString()}</span>
                </div>
              ))}
            </section>
          )}
        </div>

        <SellerApplicationActions
          applicationId={String(a._id)}
          status={a.status}
          currentUserId={user?.sub ?? ""}
          assignedToMe={assignedToMe}
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
