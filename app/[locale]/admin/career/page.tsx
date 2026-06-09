import { setRequestLocale } from "next-intl/server";
import { CtaButton } from "@/components/ui/cta-button";
import { Link } from "@/i18n/navigation";
import { DeleteRowButton } from "@/components/admin/delete-row-button";
import {
  listAdminJobs,
  countNewApplications,
} from "@/lib/repositories/career.repo";
import { localize } from "@/lib/schemas/localized";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
  temporary: "Temporary",
};

export default async function AdminCareerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Awaited<ReturnType<typeof listAdminJobs>>["items"] = [];
  let newApps = 0;
  try {
    rows = (await listAdminJobs({ pageSize: 100 })).items;
    newApps = await countNewApplications();
  } catch {
    rows = [];
  }

  const th: React.CSSProperties = {
    textAlign: "left",
    padding: "var(--s-3) var(--s-4)",
    fontFamily: "var(--font-mono)",
    fontSize: "var(--fs-caption)",
    color: "var(--color-text-muted)",
    fontWeight: 500,
    borderBottom: "1px solid var(--color-border)",
  };
  const td: React.CSSProperties = {
    padding: "var(--s-3) var(--s-4)",
    fontSize: "var(--fs-small)",
    color: "var(--color-text)",
    borderBottom: "1px solid var(--color-border)",
    verticalAlign: "middle",
  };

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
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
          Career — Jobs
        </h1>
        <div
          style={{ display: "flex", gap: "var(--s-3)", alignItems: "center" }}
        >
          <Link
            href="/admin/career/applications"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              border: "1px solid var(--color-border)",
              borderRadius: "var(--r-sm)",
              color: "var(--color-brand-deep)",
              padding: "8px 14px",
              fontSize: "var(--fs-small)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Applications
            {newApps > 0 && (
              <span
                style={{
                  display: "inline-grid",
                  placeItems: "center",
                  minWidth: 20,
                  height: 20,
                  padding: "0 6px",
                  borderRadius: 999,
                  background: "var(--color-secondary)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {newApps}
              </span>
            )}
          </Link>
          <CtaButton href="/admin/career/new">New job</CtaButton>
        </div>
      </div>

      <section
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: "var(--r-lg)",
          background: "var(--color-surface)",
          overflow: "hidden",
        }}
      >
        {rows.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: "var(--s-6)",
              textAlign: "center",
              color: "var(--color-text-muted)",
            }}
          >
            No job postings yet.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Title</th>
                <th style={th}>Department</th>
                <th style={th}>Type</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((j) => (
                <tr key={String(j._id)}>
                  <td style={{ ...td, color: "var(--color-text-strong)" }}>
                    <Link
                      href={`/admin/career/${String(j._id)}`}
                      style={{ color: "inherit" }}
                    >
                      {localize(j.title, "en")}
                    </Link>
                  </td>
                  <td style={td}>
                    {j.department ? localize(j.department, "en") : "—"}
                  </td>
                  <td style={td}>
                    {TYPE_LABEL[j.employmentType] ?? j.employmentType}
                  </td>
                  <td style={td}>{j.status}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <div
                      style={{
                        display: "inline-flex",
                        gap: "var(--s-2)",
                        alignItems: "center",
                      }}
                    >
                      <Link
                        href={`/admin/career/${String(j._id)}`}
                        style={{
                          border: "1px solid var(--color-border)",
                          borderRadius: "var(--r-sm)",
                          color: "var(--color-brand-deep)",
                          padding: "4px 10px",
                          fontSize: "var(--fs-small)",
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                      >
                        Edit
                      </Link>
                      <DeleteRowButton
                        endpoint={`/api/admin/career/${String(j._id)}`}
                        title={localize(j.title, "en")}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
