import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CtaButton } from "@/components/ui/cta-button";
import { listAllBanners } from "@/lib/repositories/banners.repo";
import { localize } from "@/lib/schemas/localized";

export const dynamic = "force-dynamic";

export default async function AdminBannersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let banners: Awaited<ReturnType<typeof listAllBanners>> = [];
  try {
    banners = await listAllBanners();
  } catch {
    banners = [];
  }

  const th: React.CSSProperties = {
    textAlign: "left",
    padding: "var(--s-3) var(--s-4)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--color-text-muted)",
    borderBottom: "1px solid var(--color-border)",
  };
  const td: React.CSSProperties = {
    padding: "var(--s-3) var(--s-4)",
    fontSize: "var(--fs-sm)",
    color: "var(--color-text)",
    borderBottom: "1px solid var(--color-border)",
  };

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
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
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-2xl)",
            color: "var(--color-text-strong)",
          }}
        >
          Banners
        </h1>
        <CtaButton href="/admin/marketplace/banners/new" variant="primary">
          New banner
        </CtaButton>
      </header>

      <section
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: "var(--r-lg)",
          background: "var(--color-surface)",
          overflow: "hidden",
        }}
      >
        {banners.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: "var(--s-6)",
              textAlign: "center",
              color: "var(--color-text-muted)",
            }}
          >
            No banners yet.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Title</th>
                <th style={th}>Slot</th>
                <th style={th}>Active</th>
                <th style={th}>Position</th>
              </tr>
            </thead>
            <tbody>
              {banners.map((b) => (
                <tr key={String(b._id)}>
                  <td style={td}>
                    <Link
                      href={`/admin/marketplace/banners/${String(b._id)}`}
                      style={{
                        color: "var(--color-brand-deep)",
                        fontWeight: 600,
                      }}
                    >
                      {localize(b.title, "en")}
                    </Link>
                  </td>
                  <td style={{ ...td, textTransform: "capitalize" }}>
                    {b.slot}
                  </td>
                  <td style={td}>{b.active ? "Yes" : "No"}</td>
                  <td style={td}>{b.position}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
