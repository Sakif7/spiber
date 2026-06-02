import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { isAdmin } from "@/lib/auth/rbac";
import { siteConfig } from "@/lib/site-config";
import { SignOutButton } from "@/components/admin/sign-out-button";

// Admin depends on the auth cookie; never statically prerender it.
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/brands", label: "Brands" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/settings", label: "Settings" },
] as const;

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
    redirect(`/${locale}/login?next=/${locale}/admin`);
  }

  const t = await getTranslations({ locale, namespace: "admin" });

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 240px) 1fr",
        minHeight: "100vh",
      }}
    >
      <aside
        style={{
          borderRight: "1px solid var(--color-border)",
          padding: "var(--s-6)",
          background: "var(--color-surface)",
        }}
      >
        <Link
          href="/admin"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            color: "var(--color-brand-deep)",
          }}
        >
          {siteConfig.brand} · {t("title")}
        </Link>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-micro)",
            textTransform: "uppercase",
            letterSpacing: "var(--tracking-eyebrow)",
            color: "var(--color-text-muted)",
            marginTop: "var(--s-6)",
            marginBottom: "var(--s-3)",
          }}
        >
          {t("groups.instruments")}
        </div>
        <nav style={{ display: "grid", gap: 2 }}>
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              style={{
                fontSize: "var(--fs-body-sm)",
                color: "var(--color-text)",
                padding: "6px 8px",
                borderRadius: "var(--r-sm)",
              }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "var(--s-4)",
            padding: "var(--s-5) var(--s-8)",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <span
            style={{
              color: "var(--color-text-muted)",
              fontSize: "var(--fs-body-sm)",
            }}
          >
            {t("welcome")}, {user?.email}
          </span>
          <SignOutButton />
        </header>
        <main style={{ padding: "var(--s-8)" }}>{children}</main>
      </div>
    </div>
  );
}
