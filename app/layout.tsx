import type { Metadata } from "next";
import {
  Inter,
  Space_Grotesk,
  Instrument_Serif,
  JetBrains_Mono,
  Hind_Siliguri,
} from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "SPIBER MED — Empowering Healthcare",
  description:
    "A Bangladesh-based medical & surgical equipment supplier and healthcare-solutions company. Trustworthy, clinical-grade, internationally credible — and warm.",
  metadataBase: new URL("https://spiberhcl.com"),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${instrumentSerif.variable} ${jetbrains.variable} ${hind.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
