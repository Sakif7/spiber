import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { PartnerActions } from "@/components/admin/partner-actions";
import { getPartnerApplicationByIdLean } from "@/lib/repositories/partnerApplications.repo";
import { getSessionUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

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

export default async function AdminPartnerDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const a = await getPartnerApplicationByIdLean(id).catch(() => null);
  if (!a) notFound();
  const user = await getSessionUser();
  const assignedToMe = Boolean(
    user && a.assignedTo && String(a.assignedTo) === user.sub,
  );

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
          {a.partnerApplicationNumber}
        </h1>
        <span style={{ ...muted, fontFamily: "var(--font-mono)" }}>
          {a.type} · {a.status} · {new Date(a.createdAt).toLocaleString()}
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
            <Row label="Organization" value={a.orgInfo.name} />
            {a.orgInfo.country && (
              <Row label="Country" value={a.orgInfo.country} />
            )}
            {a.orgInfo.website && (
              <Row label="Website" value={a.orgInfo.website} />
            )}
            <Row label="Contact" value={a.contact.name} />
            <Row label="Email" value={a.contact.email} />
            <Row label="Phone" value={a.contact.phone} />
          </section>

          {a.orgInfo.description && (
            <section style={card}>
              <strong style={{ color: "var(--color-text-strong)" }}>
                About
              </strong>
              <p style={{ margin: 0, whiteSpace: "pre-line" }}>
                {a.orgInfo.description}
              </p>
            </section>
          )}

          <section style={card}>
            <strong style={{ color: "var(--color-text-strong)" }}>
              Documents
            </strong>
            {(a.documents?.length ?? 0) === 0 ? (
              <span style={muted}>No documents uploaded.</span>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {a.documents.map((d, i) => (
                  <a
                    key={i}
                    href={`/api/media/partner/${String(a._id)}/${i}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--r-sm)",
                      color: "var(--color-brand-deep)",
                      fontSize: "var(--fs-body-sm)",
                      textDecoration: "none",
                    }}
                  >
                    <FileText size={16} aria-hidden />
                    <span style={{ wordBreak: "break-all" }}>{d.name}</span>
                  </a>
                ))}
              </div>
            )}
          </section>

          {a.activity.length > 0 && (
            <section style={card}>
              <strong style={{ color: "var(--color-text-strong)" }}>
                Activity
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

        <PartnerActions
          applicationId={String(a._id)}
          status={a.status}
          currentUserId={user?.sub ?? ""}
          assignedToMe={assignedToMe}
        />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
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
          wordBreak: "break-all",
          textAlign: "right",
        }}
      >
        {value}
      </strong>
    </div>
  );
}
