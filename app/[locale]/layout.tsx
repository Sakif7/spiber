import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  Inter,
  Space_Grotesk,
  Instrument_Serif,
  JetBrains_Mono,
  Hind_Siliguri,
} from "next/font/google";
import Script from "next/script";
import { routing } from "@/i18n/routing";
import { Providers } from "@/app/providers";
import "../globals.css";

// Pre-paint, no-flash theme script for the ADMIN area only. Runs before
// hydration on a hard load; path-guarded so it never touches the public site
// (which always stays light). Client-side navigations into /admin are handled
// by AdminThemeProvider's effect. Injected via next/script (beforeInteractive)
// so React never reconciles a raw <script> element.
const ADMIN_THEME_SCRIPT = `(function(){try{if(!/^\\/(en|bn)\\/admin(\\/|$)/.test(location.pathname))return;var p=localStorage.getItem('spiber-admin-theme');var d=p==='dark'||((p===null||p==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});
const hind = Hind_Siliguri({
  variable: "--font-hind",
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const fontVars = `${inter.variable} ${spaceGrotesk.variable} ${instrumentSerif.variable} ${jetbrains.variable} ${hind.variable}`;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    metadataBase: new URL(process.env.APP_URL ?? "https://spibermed.com"),
    title: { default: t("title"), template: `%s — ${t("brand")}` },
    description: t("description"),
    alternates: {
      languages: { en: "/en", bn: "/bn" },
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  // Enable static rendering for this locale.
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      data-locale={locale}
      className={fontVars}
      suppressHydrationWarning
    >
      <head>
        <Script id="admin-theme-no-flash" strategy="beforeInteractive">
          {ADMIN_THEME_SCRIPT}
        </Script>
      </head>
      <body>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
