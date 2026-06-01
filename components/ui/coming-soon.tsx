import { useTranslations } from "next-intl";
import { Container } from "./container";
import { Eyebrow } from "./eyebrow";
import { DotPattern } from "./dot-pattern";
import { CtaButton } from "./cta-button";

type Props = {
  /** Defaults to the `comingSoon` catalog entry when omitted. */
  title?: string;
  description?: string;
  eyebrow?: string;
  ctaLabel?: string;
  ctaHref?: string;
};

/** Branded empty state for division hubs/listings with no items yet. */
export function ComingSoon({
  title,
  description,
  eyebrow,
  ctaLabel,
  ctaHref,
}: Props) {
  const t = useTranslations("comingSoon");

  return (
    <section
      style={{
        position: "relative",
        paddingBlock: "clamp(72px, 8vw, 128px)",
        overflow: "hidden",
      }}
    >
      <DotPattern
        fade="radial"
        style={{ position: "absolute", inset: 0, opacity: 0.5, zIndex: 0 }}
      />
      <Container>
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: "var(--s-5)",
          }}
        >
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h2
            style={{
              fontSize: "var(--fs-h2)",
              color: "var(--color-text-strong)",
            }}
          >
            {title ?? t("title")}
          </h2>
          <p
            style={{
              fontSize: "var(--fs-body-lg)",
              color: "var(--color-text-muted)",
              maxWidth: "52ch",
            }}
          >
            {description ?? t("description")}
          </p>
          {ctaLabel && ctaHref && (
            <CtaButton href={ctaHref}>{ctaLabel}</CtaButton>
          )}
        </div>
      </Container>
    </section>
  );
}
