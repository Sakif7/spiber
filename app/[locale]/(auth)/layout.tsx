import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/lib/site-config";

/** Minimal centered shell for auth pages (no marketing nav/footer). */
export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "var(--s-6)",
        background: "var(--color-bg)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <Link
          href="/"
          style={{
            display: "inline-block",
            marginBottom: "var(--s-6)",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "var(--fs-h4)",
            color: "var(--color-brand-deep)",
          }}
        >
          {siteConfig.brand}
        </Link>
        <div
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--r-xl)",
            padding: "var(--s-8)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
