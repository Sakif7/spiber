import { setRequestLocale } from "next-intl/server";
import { UtilityBar } from "@/components/layout/utility-bar";
import { ResizableHeader } from "@/components/layout/resizable-header";
import { Footer } from "@/components/layout/footer";
import { AuthModalProvider } from "@/components/auth/auth-modal";

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

  return (
    <AuthModalProvider>
      <UtilityBar />
      <ResizableHeader />
      <main>{children}</main>
      <Footer />
    </AuthModalProvider>
  );
}
