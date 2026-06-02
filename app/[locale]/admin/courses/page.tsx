import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CtaButton } from "@/components/ui/cta-button";
import { listCourses } from "@/lib/repositories/courses.repo";
import { formatBDT } from "@/lib/money";
import { localize } from "@/lib/schemas/localized";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  title: string;
  level: string;
  priceMinor: number;
  lessons: number;
  status: string;
};

export default async function AdminCoursesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Row[] = [];
  try {
    const { items } = await listCourses({ pageSize: 60 });
    rows = items.map((c) => ({
      id: String(c._id),
      title: localize(c.title, "en"),
      level: c.level,
      priceMinor: c.priceMinor,
      lessons: c.modules.reduce((s, m) => s + m.lessons.length, 0),
      status: c.status,
    }));
  } catch {
    rows = [];
  }

  const th: React.CSSProperties = {
    textAlign: "left",
    padding: "var(--s-3) var(--s-4)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--color-text-muted)",
    borderBottom: "1px solid var(--color-border)",
    whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "var(--s-3) var(--s-4)",
    fontSize: "var(--fs-sm)",
    color: "var(--color-text)",
    borderBottom: "1px solid var(--color-border)",
    verticalAlign: "middle",
  };

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--s-6)" }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--s-4)",
          flexWrap: "wrap",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-2xl)",
            fontWeight: 700,
            color: "var(--color-text-strong)",
            margin: 0,
          }}
        >
          Courses
        </h1>
        <CtaButton href="/admin/courses/new" variant="primary">
          New course
        </CtaButton>
      </header>

      {rows.length === 0 ? (
        <div
          style={{
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            borderRadius: "var(--r-lg)",
            padding: "var(--s-8)",
            textAlign: "center",
            color: "var(--color-text-muted)",
          }}
        >
          No courses yet.
        </div>
      ) : (
        <div
          style={{
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "640px",
              }}
            >
              <thead>
                <tr>
                  <th style={th}>Title</th>
                  <th style={th}>Level</th>
                  <th style={{ ...th, textAlign: "right" }}>Price</th>
                  <th style={{ ...th, textAlign: "right" }}>Lessons</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td style={td}>
                      <Link
                        href={`/admin/courses/${c.id}`}
                        style={{
                          color: "var(--color-brand-deep)",
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                      >
                        {c.title || "(untitled)"}
                      </Link>
                    </td>
                    <td
                      style={{
                        ...td,
                        textTransform: "capitalize",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {c.level}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {c.priceMinor > 0
                        ? formatBDT(c.priceMinor, "en")
                        : "Free"}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>{c.lessons}</td>
                    <td style={{ ...td, textTransform: "capitalize" }}>
                      {c.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
