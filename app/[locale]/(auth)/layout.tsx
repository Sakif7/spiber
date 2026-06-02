import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/lib/site-config";

/**
 * Split-screen auth shell: a teal brand panel (left) + the form (right).
 * The panel collapses on small screens, leaving a clean centered form.
 */
export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth.panel" });
  const points = t.raw("points") as string[];

  return (
    <div
      className="auth-grid"
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
        background: "var(--color-surface)",
      }}
    >
      <aside
        className="auth-panel"
        style={{
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: "var(--s-8)",
          padding: "clamp(40px, 5vw, 72px)",
          background:
            "linear-gradient(155deg, var(--teal-700) 0%, var(--teal-900) 100%)",
          color: "white",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            maskImage: "linear-gradient(165deg, #000 10%, transparent 78%)",
            WebkitMaskImage:
              "linear-gradient(165deg, #000 10%, transparent 78%)",
          }}
        />
        <Link
          href="/"
          style={{
            position: "relative",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "var(--fs-h5)",
            letterSpacing: "var(--tracking-heading)",
            color: "white",
            textDecoration: "none",
          }}
        >
          {siteConfig.brand}
        </Link>

        <div style={{ position: "relative" }}>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: "clamp(28px, 2.6vw, 40px)",
              lineHeight: 1.12,
              letterSpacing: "-0.02em",
              margin: 0,
              maxWidth: "16ch",
              textWrap: "balance",
            }}
          >
            {t("title")}
          </h2>
          <p
            style={{
              margin: "18px 0 0",
              fontSize: "var(--fs-body-lg)",
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.82)",
              maxWidth: "42ch",
            }}
          >
            {t("subtitle")}
          </p>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: "30px 0 0",
              display: "grid",
              gap: 14,
            }}
          >
            {points.map((p) => (
              <li
                key={p}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: "var(--fs-body-sm)",
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 22,
                    height: 22,
                    flexShrink: 0,
                    borderRadius: "var(--r-pill)",
                    background: "rgba(255,255,255,0.14)",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M20 6L9 17l-5-5"
                      stroke="white"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div
          style={{
            position: "relative",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-micro)",
            letterSpacing: "var(--tracking-eyebrow)",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.6)",
          }}
        >
          {siteConfig.domain}
        </div>
      </aside>

      <div
        style={{
          display: "grid",
          placeItems: "center",
          padding: "var(--s-8) var(--s-6)",
        }}
      >
        <div style={{ width: "100%", maxWidth: 400 }}>
          <Link
            href="/"
            className="auth-mobile-logo"
            style={{
              marginBottom: "var(--s-6)",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "var(--fs-h5)",
              color: "var(--color-brand-deep)",
              textDecoration: "none",
            }}
          >
            {siteConfig.brand}
          </Link>
          {children}
        </div>
      </div>

      <style>{`
        .auth-mobile-logo { display: none; }
        @media (max-width: 880px) {
          .auth-grid { grid-template-columns: 1fr !important; }
          .auth-panel { display: none !important; }
          .auth-mobile-logo { display: inline-block !important; }
        }
      `}</style>
    </div>
  );
}
