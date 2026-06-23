import { setRequestLocale } from "next-intl/server";

import { Section, Container } from "@/components/ui";
import { JsonLd } from "@/components/ui/json-ld";
import { localBusinessJsonLd } from "@/lib/seo/jsonld";
import { namespaceMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/i18n/routing";

import { ContactHero } from "@/components/contact/contact-hero";
import { ContactForm } from "@/components/contact/contact-form";
import { LocationPanel } from "@/components/contact/location-panel";
import { QuickContact } from "@/components/contact/quick-contact";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return namespaceMetadata(locale as Locale, "pages.contact", "/contact");
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <JsonLd data={localBusinessJsonLd(locale as Locale)} />
      <ContactHero />

      <Section style={{ background: "var(--color-bg)" }}>
        <Container>
          <div
            className="equal-2col"
            style={{
              display: "grid",
              gridTemplateColumns: "1.05fr 0.95fr",
              gap: "clamp(24px, 3.5vw, 44px)",
              alignItems: "stretch",
            }}
          >
            <ContactForm />
            <LocationPanel />
          </div>
        </Container>
      </Section>

      <QuickContact />
    </>
  );
}
