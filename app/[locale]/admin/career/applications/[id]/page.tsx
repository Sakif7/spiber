import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ApplicationStatusSelect } from "@/components/admin/career/application-status";
import { getApplicationByIdLean } from "@/lib/repositories/career.repo";

export const dynamic = "force-dynamic";

const card: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  borderRadius: "var(--r-lg)",
  padding: "var(--s-6)",
  display: "grid",
  gap: "var(--s-4)",
};

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--fs-caption)",
          textTransform: "uppercase",
          letterSpacing: "var(--tracking-eyebrow)",
          color: "var(--color-text-subtle)",
        }}
      >
        {label}
      </span>
      <span style={{ color: "var(--color-text-strong)" }}>{children}</span>
    </div>
  );
}

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const app = await getApplicationByIdLean(id).catch(() => null);
  if (!app) notFound();

  return (
    <div style={{ display: "grid", gap: "var(--s-6)", maxWidth: 760 }}>
      <Link
        href="/admin/career/applications"
        style={{
          color: "var(--color-brand-deep)",
          fontSize: "var(--fs-small)",
          fontWeight: 600,
        }}
      >
        ← All applications
      </Link>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--s-3)",
          flexWrap: "wrap",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-2xl)",
            color: "var(--color-text-strong)",
          }}
        >
          {app.name}
        </h1>
        <ApplicationStatusSelect id={String(app._id)} status={app.status} />
      </div>

      <section style={card}>
        <Row label="Position">{app.jobTitle ?? "—"}</Row>
        <Row label="Email">
          <a
            href={`mailto:${app.email}`}
            style={{ color: "var(--color-brand-deep)" }}
          >
            {app.email}
          </a>
        </Row>
        <Row label="Phone">
          <a
            href={`tel:${app.phone}`}
            style={{ color: "var(--color-brand-deep)" }}
          >
            {app.phone}
          </a>
        </Row>
        <Row label="Applied">{new Date(app.createdAt).toLocaleString()}</Row>
        <Row label="Reference">{app.applicationNumber}</Row>
        <div>
          <a
            href={`/api/admin/career/applications/${String(app._id)}/resume`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderRadius: "var(--r-pill)",
              background: "var(--color-brand)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
              boxShadow: "var(--shadow-brand)",
            }}
          >
            Download résumé{app.resumeName ? ` (${app.resumeName})` : ""}
          </a>
        </div>
      </section>

      {app.coverLetter && (
        <section style={card}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--fs-caption)",
              textTransform: "uppercase",
              letterSpacing: "var(--tracking-eyebrow)",
              color: "var(--color-text-subtle)",
            }}
          >
            Cover letter
          </span>
          <p
            style={{
              margin: 0,
              whiteSpace: "pre-line",
              lineHeight: 1.65,
              color: "var(--color-text)",
            }}
          >
            {app.coverLetter}
          </p>
        </section>
      )}
    </div>
  );
}
