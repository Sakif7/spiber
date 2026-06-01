import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { isAdmin } from "@/lib/auth/rbac";
import { siteConfig } from "@/lib/site-config";
import { SignOutButton } from "@/components/admin/sign-out-button";

// Admin depends on the auth cookie; never statically prerender it.
export const dynamic = "force-dynamic";

const GROUPS = [
  "overview",
  "instruments",
  "academy",
  "systems",
  "tourism",
  "consulting",
  "blog",
  "platform",
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
        gridTemplateColumns: "minmax(0, 260px) 1fr",
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
        <nav
          style={{
            marginTop: "var(--s-6)",
            display: "grid",
            gap: "var(--s-3)",
          }}
        >
          {GROUPS.map((g) => (
            <span
              key={g}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--fs-caption)",
                textTransform: "uppercase",
                letterSpacing: "var(--tracking-eyebrow)",
                color: "var(--color-text-muted)",
              }}
            >
              {t(`groups.${g}`)}
            </span>
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
