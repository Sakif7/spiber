import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { isAdmin } from "@/lib/auth/rbac";
import { siteConfig } from "@/lib/site-config";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { AdminNav } from "@/components/admin/admin-nav";
import { SessionKeepAlive } from "@/components/admin/session-keep-alive";

// Admin depends on the auth cookie; never statically prerender it.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Defense-in-depth: the proxy also guards /admin, but re-check here.
  const user = await getSessionUser();
  if (!isAdmin(user)) {
    redirect(`/${locale}?auth=login&next=/${locale}/admin`);
  }

  const t = await getTranslations({ locale, namespace: "admin" });
  const initial = (user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 248px) 1fr",
        minHeight: "100vh",
        background: "var(--color-bg)",
      }}
    >
      <SessionKeepAlive />
      <aside
        style={{
          borderRight: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          position: "sticky",
          top: 0,
          alignSelf: "start",
          height: "100vh",
          // Scroll the nav independently so long sidebars (8 groups) never cut
          // off the bottom items.
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--s-5)",
          padding: "var(--s-6) var(--s-5)",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            padding: "0 8px",
            textDecoration: "none",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "var(--fs-h6)",
              letterSpacing: "var(--tracking-heading)",
              color: "var(--color-brand-deep)",
            }}
          >
            {siteConfig.brand}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--fs-micro)",
              textTransform: "uppercase",
              letterSpacing: "var(--tracking-eyebrow)",
              color: "var(--color-text-subtle)",
            }}
          >
            {t("title")}
          </span>
        </Link>

        <AdminNav />
      </aside>

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "var(--s-4)",
            padding: "var(--s-4) var(--s-8)",
            borderBottom: "1px solid var(--color-border)",
            background:
              "color-mix(in srgb, var(--color-surface) 88%, transparent)",
            backdropFilter: "saturate(180%) blur(8px)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--s-3)",
            }}
          >
            <span
              aria-hidden
              style={{
                display: "grid",
                placeItems: "center",
                width: 32,
                height: 32,
                borderRadius: "var(--r-pill)",
                background: "var(--color-brand-soft)",
                color: "var(--color-brand-deep)",
                fontWeight: 700,
                fontSize: "var(--fs-small)",
              }}
            >
              {initial}
            </span>
            <span
              style={{
                color: "var(--color-text-muted)",
                fontSize: "var(--fs-body-sm)",
              }}
            >
              {t("welcome")},{" "}
              <strong style={{ color: "var(--color-text-strong)" }}>
                {user?.email}
              </strong>
            </span>
          </div>
          <SignOutButton />
        </header>
        <main style={{ padding: "var(--s-8)" }}>{children}</main>
      </div>
    </div>
  );
}
