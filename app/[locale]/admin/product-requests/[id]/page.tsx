import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ProductRequestActions } from "@/components/admin/product-request-actions";
import { getProductRequestByIdLean } from "@/lib/repositories/product-requests.repo";
import { getSessionUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function AdminProductRequestDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const r = await getProductRequestByIdLean(id).catch(() => null);
  if (!r) notFound();
  const user = await getSessionUser();
  const assignedToMe = Boolean(
    user && r.assignedTo && String(r.assignedTo) === user.sub,
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
          {r.productName}
        </h1>
        <span style={{ ...muted, fontFamily: "var(--font-mono)" }}>
          {r.requestNumber} · {r.status}
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
            <Row label="Product" value={r.productName} />
            {r.category && <Row label="Category" value={r.category} />}
            {r.brand && <Row label="Brand" value={r.brand} />}
            {r.quantity != null && (
              <Row label="Quantity" value={String(r.quantity)} />
            )}
            {r.budget && <Row label="Budget" value={r.budget} />}
            {r.referenceUrl && (
              <Row label="Reference URL" value={r.referenceUrl} mono />
            )}
          </section>

          <section style={card}>
            <Row label="Requested by" value={r.name} />
            <Row label="Email" value={r.email} />
            {r.phone && <Row label="Phone" value={r.phone} />}
          </section>

          {r.details && (
            <section style={card}>
              <strong style={{ color: "var(--color-text-strong)" }}>
                Details
              </strong>
              <p
                style={{
                  margin: 0,
                  whiteSpace: "pre-line",
                  color: "var(--color-text)",
                }}
              >
                {r.details}
              </p>
            </section>
          )}

          {r.notes.length > 0 && (
            <section style={card}>
              <strong style={{ color: "var(--color-text-strong)" }}>
                Notes
              </strong>
              {r.notes.map((n, i) => (
                <div key={i} style={{ display: "grid", gap: 2 }}>
                  <span style={{ color: "var(--color-text)" }}>{n.body}</span>
                  <span style={muted}>{new Date(n.at).toLocaleString()}</span>
                </div>
              ))}
            </section>
          )}
        </div>

        <ProductRequestActions
          requestId={String(r._id)}
          status={r.status}
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
