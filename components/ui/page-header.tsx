import Image from "next/image";
import { Container } from "./container";
import { Eyebrow } from "./eyebrow";
import { Reveal } from "./reveal";
import { HeroCarousel } from "./hero-carousel";
import { Breadcrumb, type Crumb } from "./breadcrumb";

type Stat = { value: string; label: string };

type Props = {
  title: string;
  eyebrow?: string;
  description?: string;
  breadcrumbs?: Crumb[];
  /** Full-bleed background photo (from /public). Switches to the dark hero. */
  image?: string;
  /** Multiple photos → crossfading hero carousel (also triggers the hero). */
  images?: string[];
  imageAlt?: string;
  /** Optional stat line under the lede (e.g. product / brand counts). */
  stats?: Stat[];
};

/** Standard interior-page header: optional breadcrumb + eyebrow + title + lede. */
export function PageHeader({
  title,
  eyebrow,
  description,
  breadcrumbs,
  image,
  images,
  imageAlt,
  stats,
}: Props) {
  if (image || (images && images.length > 0))
    return (
      <HeroHeader
        {...{
          title,
          eyebrow,
          description,
          breadcrumbs,
          image,
          images,
          imageAlt,
          stats,
        }}
      />
    );

  return (
    <header
      style={{
        paddingTop: "calc(var(--s-24) + 40px)",
        paddingBottom: "var(--s-12)",
        borderBottom: "1px solid var(--color-hairline)",
        background: "var(--color-surface)",
      }}
    >
      <Container>
        <Reveal>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-4)",
            }}
          >
            {breadcrumbs && breadcrumbs.length > 0 && (
              <Breadcrumb items={breadcrumbs} />
            )}
            {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
            <h1
              style={{
                fontSize: "var(--fs-h1)",
                lineHeight: "var(--lh-heading)",
                letterSpacing: "var(--tracking-heading)",
                color: "var(--color-text-strong)",
                maxWidth: "20ch",
              }}
            >
              {title}
            </h1>
            {description && (
              <p
                style={{
                  fontSize: "var(--fs-body-lg)",
                  color: "var(--color-text-muted)",
                  maxWidth: "60ch",
                }}
              >
                {description}
              </p>
            )}
          </div>
        </Reveal>
      </Container>
    </header>
  );
}

/** Photo-backed hero: full-bleed image + teal/ink wash, white text over it. */
function HeroHeader({
  title,
  eyebrow,
  description,
  breadcrumbs,
  image,
  images,
  imageAlt,
  stats,
}: Props) {
  const carousel = images && images.length > 1;
  return (
    <header
      style={{
        position: "relative",
        isolation: "isolate",
        display: "flex",
        alignItems: "flex-end",
        minHeight: "clamp(300px, 40vw, 460px)",
        paddingTop: "calc(var(--s-24) + 24px)",
        paddingBottom: "var(--s-12)",
        overflow: "hidden",
        background: "var(--color-brand-deep)",
      }}
    >
      {carousel ? (
        <HeroCarousel images={images!} alt={imageAlt ?? ""} />
      ) : (
        <Image
          src={image ?? images![0]}
          alt={imageAlt ?? ""}
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover", zIndex: -2 }}
        />
      )}
      {/* Legibility wash: ink gradient from the bottom-left + a teal tint. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: -1,
          background:
            "linear-gradient(105deg, color-mix(in oklab, var(--color-brand-deep) 92%, transparent) 0%, color-mix(in oklab, var(--color-brand-deep) 70%, transparent) 38%, rgba(7,23,33,0.28) 78%), linear-gradient(0deg, rgba(7,23,33,0.55), rgba(7,23,33,0.05) 60%)",
        }}
      />
      {/* Dot motif, brand signature, top-right. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: -1,
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
          maskImage:
            "radial-gradient(120% 140% at 100% 0%, #000, transparent 60%)",
          WebkitMaskImage:
            "radial-gradient(120% 140% at 100% 0%, #000, transparent 60%)",
        }}
      />
      <Container style={{ position: "relative", width: "100%" }}>
        <Reveal>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-4)",
            }}
          >
            {breadcrumbs && breadcrumbs.length > 0 && (
              <Breadcrumb items={breadcrumbs} tone="onDark" />
            )}
            {eyebrow && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--fs-caption)",
                  textTransform: "uppercase",
                  letterSpacing: "var(--tracking-eyebrow)",
                  color: "var(--orange-300)",
                }}
              >
                {eyebrow}
              </span>
            )}
            <h1
              style={{
                fontSize: "var(--fs-h1)",
                lineHeight: "var(--lh-heading)",
                letterSpacing: "var(--tracking-heading)",
                color: "#fff",
                maxWidth: "20ch",
                textShadow: "0 2px 24px rgba(7,23,33,0.45)",
              }}
            >
              {title}
            </h1>
            {description && (
              <p
                style={{
                  fontSize: "var(--fs-body-lg)",
                  color: "rgba(255,255,255,0.86)",
                  maxWidth: "58ch",
                  textShadow: "0 1px 16px rgba(7,23,33,0.4)",
                }}
              >
                {description}
              </p>
            )}
            {stats && stats.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--s-6)",
                  marginTop: "var(--s-2)",
                }}
              >
                {stats.map((s) => (
                  <div key={s.label} style={{ display: "grid", gap: 2 }}>
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "var(--fs-h4)",
                        fontWeight: 700,
                        color: "#fff",
                      }}
                    >
                      {s.value}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--fs-micro)",
                        textTransform: "uppercase",
                        letterSpacing: "var(--tracking-eyebrow)",
                        color: "rgba(255,255,255,0.7)",
                      }}
                    >
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Reveal>
      </Container>
    </header>
  );
}
