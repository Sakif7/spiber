import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ManualEnrollForm } from "@/components/admin/academy/manual-enroll-form";
import { listEnrollments } from "@/lib/repositories/enrollments.repo";
import { listCourses } from "@/lib/repositories/courses.repo";
import { localize } from "@/lib/schemas/localized";
import { formatBDT } from "@/lib/money";
import type { EnrollmentStatus } from "@/lib/schemas/enrollment";

export const dynamic = "force-dynamic";

const FILTERS: Array<{ key: "all" | EnrollmentStatus; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "active", label: "Active" },
  { key: "cancelled", label: "Cancelled" },
  { key: "refunded", label: "Refunded" },
];
const VALID = new Set<EnrollmentStatus>([
  "pending",
  "active",
  "cancelled",
  "refunded",
]);

const STATUS_COLOR: Record<string, string> = {
  pending: "var(--color-text-muted)",
  active: "var(--color-success)",
  cancelled: "var(--color-error)",
  refunded: "var(--color-error)",
};

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

export default async function AdminEnrollmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { status: raw } = await searchParams;
  const active =
    raw && VALID.has(raw as EnrollmentStatus)
      ? (raw as EnrollmentStatus)
      : undefined;

  let items: Awaited<ReturnType<typeof listEnrollments>>["items"] = [];
  let courseTitles = new Map<string, string>();
  try {
    const [res, courses] = await Promise.all([
      listEnrollments({ status: active, pageSize: 100 }),
      listCourses({ pageSize: 200 }),
    ]);
    items = res.items;
    courseTitles = new Map(
      courses.items.map((c) => [String(c._id), localize(c.title, "en")]),
    );
  } catch {
    items = [];
  }

  const courseOptions = Array.from(courseTitles, ([id, title]) => ({
    id,
    title,
  }));

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)" }}
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
        Enrollments
      </h1>

      <ManualEnrollForm courses={courseOptions} />

      <nav style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)" }}>
        {FILTERS.map(({ key, label }) => {
          const isActive =
            key === "all" ? active === undefined : active === key;
          return (
            <Link
              key={key}
              href={
                key === "all"
                  ? "/admin/enrollments"
                  : `/admin/enrollments?status=${key}`
              }
              style={{
                padding: "var(--s-1) var(--s-3)",
                fontSize: "var(--fs-sm)",
                fontWeight: 600,
                borderRadius: "var(--r-sm)",
                textDecoration: "none",
                border: "1px solid var(--color-border)",
                background: isActive
                  ? "var(--color-brand)"
                  : "var(--color-surface)",
                color: isActive ? "#fff" : "var(--color-text-muted)",
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: "var(--r-lg)",
          background: "var(--color-surface)",
          overflow: "hidden",
        }}
      >
        {items.length === 0 ? (
          <div
            style={{
              padding: "var(--s-8)",
              textAlign: "center",
              color: "var(--color-text-muted)",
            }}
          >
            No enrollments found.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "720px",
              }}
            >
              <thead>
                <tr>
                  <th style={th}>Reference</th>
                  <th style={th}>Course</th>
                  <th style={th}>Student</th>
                  <th style={th}>Status</th>
                  <th style={th}>Payment</th>
                  <th style={{ ...th, textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => {
                  const id = String(e._id);
                  return (
                    <tr key={id}>
                      <td style={td}>
                        <Link
                          href={`/admin/enrollments/${id}`}
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontWeight: 600,
                            color: "var(--color-brand-deep)",
                            textDecoration: "none",
                          }}
                        >
                          {e.enrollmentNumber}
                        </Link>
                      </td>
                      <td style={td}>
                        {courseTitles.get(String(e.courseId)) ?? "—"}
                      </td>
                      <td style={td}>{e.email}</td>
                      <td style={td}>
                        <span
                          style={{
                            fontWeight: 600,
                            color:
                              STATUS_COLOR[e.status] ?? "var(--color-text)",
                          }}
                        >
                          {e.status}
                        </span>
                      </td>
                      <td style={{ ...td, color: "var(--color-text-muted)" }}>
                        {e.payment?.status ?? "—"}
                      </td>
                      <td
                        style={{
                          ...td,
                          textAlign: "right",
                          fontFamily: "var(--font-mono)",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {e.totalMinor > 0
                          ? formatBDT(e.totalMinor, "en")
                          : "Free"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
