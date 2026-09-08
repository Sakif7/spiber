import { getTranslations, getLocale } from "next-intl/server";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { SectionTitle } from "@/components/ui/section-title";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Breadcrumb } from "@/components/ui/site-breadcrumb";
import { DotPattern } from "@/components/ui/dot-pattern";
import {
  AnimatedTestimonials,
  type AnimatedTestimonial,
} from "@/components/ui/animated-testimonials";
import { listDestinations } from "@/lib/repositories/destinations.repo";
import { getTestimonials } from "@/lib/services/landing.service";
import { localize } from "@/lib/schemas/localized";
import { HERO, heroPosition } from "@/lib/hero-images";
import { CONTACT } from "@/lib/contact";
import {
  Globe,
  Building2,
  FileCheck,
  HeartHandshake,
  MessageCircle,
  Phone,
  Mail,
  ArrowRight,
  Quote,
  type LucideIcon,
} from "lucide-react";
import {
  DestinationsGrid,
  type DestinationItem,
} from "@/components/tourism/hub-client";
import type { Locale } from "@/i18n/routing";

// The animated/interactive sections live in the client module; re-export them
// so the page keeps a single import surface.
export {
  ServiceOverview,
  PopularTreatments,
  HowItWorks,
  TravelSupport,
  WhyChoose,
} from "@/components/tourism/hub-client";

const ORANGE = "var(--color-secondary)";
const SECTION_PY = "clamp(44px, 5.5vw, 72px)";

/* ====================================================== HERO */
export async function TourismHero() {
  const t = await getTranslations("tourism");
  const hub = await getTranslations("hubs.tourism");
  const nav = await getTranslations("nav");
  const img = HERO.tourismHub;

  const stats: { icon: LucideIcon; value?: string; label: string }[] = [
    { icon: Globe, value: "10+", label: t("heroStats.countries") },
    { icon: Building2, value: "200+", label: t("heroStats.hospitals") },
    { icon: FileCheck, label: t("heroStats.visa") },
    { icon: HeartHandshake, label: t("heroStats.followup") },
  ];

  return (
    <header
      style={{
        position: "relative",
        overflow: "hidden",
        background: "var(--color-surface-inv)",
      }}
    >
      <Image
        src={img}
        alt={hub("title")}
        fill
        priority
        sizes="100vw"
        style={{ objectFit: "cover", objectPosition: heroPosition(img) }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(100deg, rgba(2,18,22,.94) 0%, rgba(8,52,56,.84) 36%, rgba(8,52,56,.32) 68%, rgba(8,52,56,.04) 100%)",
        }}
      />
      <DotPattern color="rgba(255,255,255,.10)" fade="left" />
      <Container style={{ position: "relative" }}>
        <div
          style={{
            paddingBlock: "clamp(40px, 6vw, 84px)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--s-4)",
            color: "#fff",
          }}
        >
          <Breadcrumb
            tone="onDark"
            items={[{ label: nav("home"), href: "/" }, { label: hub("title") }]}
          />
          <div
            style={{
              maxWidth: "42rem",
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-3)",
            }}
          >
            <Eyebrow dark>{hub("eyebrow")}</Eyebrow>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontSize: "var(--fs-h1)",
                lineHeight: 1.05,
                letterSpacing: "-.02em",
              }}
            >
              {hub("title")}
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: "var(--fs-h4)",
                fontWeight: 500,
                lineHeight: 1.3,
              }}
            >
              {t("heroSubtitle")}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "var(--fs-body-lg)",
                color: "rgba(255,255,255,.8)",
                maxWidth: "36rem",
                lineHeight: 1.55,
              }}
            >
              {hub("description")}
            </p>
            <div
              style={{
                display: "flex",
                gap: "var(--s-3)",
                flexWrap: "wrap",
                marginTop: 4,
              }}
            >
              <Link href="/tourism/packages" style={solidBtn(ORANGE)}>
                {t("getCost")}
                <ArrowRight size={16} aria-hidden />
              </Link>
              <Link
                href="/tourism/request-consultation"
                style={outlineBtnOnDark}
              >
                {t("hub.startCase")}
              </Link>
            </div>
          </div>

          {/* Stats strip — inside the hero band */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              marginTop: "var(--s-5)",
              maxWidth: 680,
              borderRadius: "var(--r-lg)",
              background: "rgba(255,255,255,.07)",
              border: "1px solid rgba(255,255,255,.16)",
              overflow: "hidden",
            }}
          >
            {stats.map((s, i) => {
              const Icon = s.icon;
              return (
                <div
                  key={i}
                  style={{
                    flex: "1 1 150px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "14px 16px",
                    borderLeft:
                      i === 0 ? "none" : "1px solid rgba(255,255,255,.12)",
                  }}
                >
                  <Icon
                    size={20}
                    style={{ color: "var(--aqua-300)", flexShrink: 0 }}
                    aria-hidden
                  />
                  <div style={{ display: "grid", lineHeight: 1.2 }}>
                    {s.value && (
                      <span
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "var(--fs-lg)",
                          fontWeight: 600,
                        }}
                      >
                        {s.value}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: "var(--fs-caption)",
                        color: "rgba(255,255,255,.82)",
                      }}
                    >
                      {s.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Container>
    </header>
  );
}

/* ===================================== FEATURED DESTINATIONS (server data) */
const DEST_FALLBACK = [
  "/cherry-blossom-tree-lined-road.jpeg",
  "/modern-operating-room-equipment.jpeg",
  "/surgical-team-portrait-in-operating-room.jpeg",
  "/doctor-and-nurse-holding-xray-corridor.jpeg",
  "/smiling-medical-team-portrait.jpeg",
  "/nurse-holding-patient-hand-reassurance.jpeg",
];

export async function FeaturedDestinations() {
  const t = await getTranslations("tourism");
  const locale = (await getLocale()) as Locale;
  let docs: Awaited<ReturnType<typeof listDestinations>>["items"] = [];
  try {
    docs = (await listDestinations({ status: "active", pageSize: 8 })).items;
  } catch {
    docs = [];
  }
  if (docs.length === 0) return null;

  const items: DestinationItem[] = docs.map((d, i) => ({
    id: String(d._id),
    href: `/tourism/destination/${d.slug}`,
    title: localize(d.name, locale),
    image:
      typeof d.heroImage === "string" && d.heroImage
        ? d.heroImage
        : DEST_FALLBACK[i % DEST_FALLBACK.length],
  }));

  return (
    <Section
      py={SECTION_PY}
      style={{ background: "var(--color-surface-2, #f7f9fa)" }}
    >
      <Container>
        <SectionTitle
          title={t("hub.featuredDestinations")}
          lede={t("destinationsLede")}
          align="center"
          maxLede="46ch"
        />
        <DestinationsGrid items={items} />
      </Container>
    </Section>
  );
}

/* =================================== CARE MANAGER */
export async function CareManagerCard() {
  const t = await getTranslations("tourism.careManager");
  const rows = [
    {
      icon: MessageCircle,
      label: t("whatsapp"),
      value: CONTACT.phone,
      href: `https://wa.me/${CONTACT.phoneHref.replace(/[^0-9]/g, "")}`,
    },
    {
      icon: Phone,
      label: t("call"),
      value: CONTACT.phone,
      href: `tel:${CONTACT.phoneHref}`,
    },
    {
      icon: Mail,
      label: t("email"),
      value: "tourism@spibermed.com",
      href: "mailto:tourism@spibermed.com",
    },
  ];
  const stats = [
    { value: "10+", label: t("statCountries") },
    { value: "200+", label: t("statHospitals") },
    { value: "98%", label: t("statSatisfaction") },
  ];
  return (
    <div
      style={{
        display: "grid",
        gap: "var(--s-4)",
        padding: "var(--s-6)",
        borderRadius: "var(--r-lg)",
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        height: "100%",
      }}
    >
      <Eyebrow>{t("eyebrow")}</Eyebrow>
      <div style={{ display: "flex", gap: "var(--s-4)", alignItems: "center" }}>
        <span style={avatar(56)} aria-hidden>
          FR
        </span>
        <div style={{ display: "grid", gap: 2 }}>
          <strong style={{ color: "var(--color-text-strong)" }}>
            {t("name")}
          </strong>
          <span
            style={{
              fontSize: "var(--fs-body-sm)",
              color: "var(--color-text-muted)",
            }}
          >
            {t("role")}
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: "var(--fs-caption)",
              color: "var(--color-success)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--color-success)",
              }}
              aria-hidden
            />{" "}
            {t("online")}
          </span>
        </div>
      </div>
      <blockquote
        style={{
          margin: 0,
          display: "flex",
          gap: 8,
          color: "var(--color-text)",
          fontStyle: "italic",
        }}
      >
        <Quote
          size={16}
          style={{ color: "var(--color-brand)", flexShrink: 0, marginTop: 3 }}
          aria-hidden
        />
        <span>{t("quote")}</span>
      </blockquote>
      <div style={{ display: "grid", gap: 8 }}>
        {rows.map((r, i) => {
          const Icon = r.icon;
          return (
            <a
              key={i}
              href={r.href}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                textDecoration: "none",
                color: "var(--color-text)",
                fontSize: "var(--fs-body-sm)",
              }}
            >
              <Icon
                size={16}
                style={{ color: "var(--color-brand-deep)" }}
                aria-hidden
              />
              <span style={{ color: "var(--color-text-muted)", minWidth: 64 }}>
                {r.label}
              </span>
              <span style={{ color: "var(--color-text-strong)" }}>
                {r.value}
              </span>
            </a>
          );
        })}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: "var(--fs-caption)",
          color: "var(--color-text-muted)",
        }}
      >
        {t("responseNote")}
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: "var(--s-3)",
          paddingTop: "var(--s-3)",
          borderTop: "1px solid var(--color-border)",
        }}
      >
        {stats.map((s, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--fs-lg)",
                fontWeight: 700,
                color: "var(--color-brand-deep)",
              }}
            >
              {s.value}
            </div>
            <div
              style={{
                fontSize: "var(--fs-caption)",
                color: "var(--color-text-muted)",
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =================================== PATIENT STORIES (testimonials DB) */
const STORY_FALLBACK_PHOTO = "/nurse-holding-patient-hand-reassurance.jpeg";

export async function PatientStories() {
  const t = await getTranslations("tourism.stories");
  let testimonials: Awaited<ReturnType<typeof getTestimonials>> = [];
  try {
    testimonials = await getTestimonials("tourism");
  } catch {
    testimonials = [];
  }

  const items: AnimatedTestimonial[] = testimonials.map((x) => ({
    quote: x.quote,
    name: x.name,
    designation: x.role,
    src: x.imageSrc || STORY_FALLBACK_PHOTO,
  }));

  return (
    <Section
      py={SECTION_PY}
      style={{ background: "var(--color-surface-2, #f7f9fa)" }}
    >
      <Container>
        <SectionTitle title={t("heading")} lede={t("lede")} align="center" />
        {items.length > 0 ? (
          <div style={{ marginTop: "var(--s-10)" }}>
            <AnimatedTestimonials testimonials={items} autoplay />
          </div>
        ) : (
          <p
            style={{
              marginTop: "var(--s-8)",
              textAlign: "center",
              color: "var(--color-text-muted)",
            }}
          >
            {t("empty")}
          </p>
        )}
      </Container>
    </Section>
  );
}

/* ----------------------------------------------------------- shared styles */
function avatar(size: number): React.CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: "var(--r-pill)",
    background: "var(--color-brand-soft)",
    color: "var(--color-brand-deep)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: size > 48 ? "var(--fs-lg)" : "var(--fs-body)",
    flexShrink: 0,
  };
}

function solidBtn(bg: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    height: 46,
    padding: "0 22px",
    borderRadius: "var(--r-pill)",
    background: bg,
    color: "#fff",
    fontWeight: 600,
    fontSize: 15,
    textDecoration: "none",
    boxShadow: "var(--shadow-md)",
  };
}

const outlineBtnOnDark: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  height: 46,
  padding: "0 22px",
  borderRadius: "var(--r-pill)",
  background: "rgba(255,255,255,.08)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,.4)",
  fontWeight: 600,
  fontSize: 15,
  textDecoration: "none",
};
