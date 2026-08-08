import { setRequestLocale } from "next-intl/server";
import { UtilityBar } from "@/components/layout/utility-bar";
import { ResizableHeader } from "@/components/layout/resizable-header";
import { Footer } from "@/components/layout/footer";
import { AuthModalProvider } from "@/components/auth/auth-modal";
import { cookies } from "next/headers";
import { SessionKeepAlive } from "@/components/auth/session-keep-alive";
import { getSessionUser } from "@/lib/auth/current-user";
import { COOKIE } from "@/lib/auth/session";
import { RouteTransitionOverlay } from "@/components/layout/route-transition-overlay";
import { LightModeGuard } from "@/components/layout/light-mode-guard";
import { ChatWidget } from "@/components/chat/chat-widget";
import { JsonLd } from "@/components/ui/json-ld";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";
import type { Locale } from "@/i18n/routing";

/**
 * Public marketing shell: utility bar + header + footer wrap every public
 * page. Admin and auth pages live outside this group and skip the shell.
 */
export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Cookie + jose only (no DB): mount the keep-alive whenever a session exists
  // OR a refresh cookie is present (expired access + valid refresh on a public
  // page self-heals via the keep-alive's immediate refresh). Anonymous visitors
  // never fire pointless refresh calls.
  const session = await getSessionUser();
  const hasRefreshCookie = Boolean(
    (await cookies()).get(COOKIE.refresh)?.value,
  );

  return (
    <AuthModalProvider>
      {session || hasRefreshCookie ? <SessionKeepAlive /> : null}
      {/* Site-wide structured data: Organization + WebSite (sitelinks search). */}
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={websiteJsonLd(locale as Locale)} />
      <LightModeGuard />
      <RouteTransitionOverlay />
      <header>
        <UtilityBar />
        <ResizableHeader />
      </header>
      <main>{children}</main>
      <Footer />
      <ChatWidget />
    </AuthModalProvider>
  );
}
