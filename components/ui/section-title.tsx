import { CSSProperties } from "react";
import { Eyebrow } from "./eyebrow";
import { Reveal } from "./reveal";

/**
 * SectionTitle — eyebrow + headline + lede, the standard section opener.
 * Title and lede each fade up in sequence as the block scrolls into view.
 */
export function SectionTitle({
  eyebrow,
  title,
  lede,
  dark,
  align = "left",
  maxTitle = "20ch",
  maxLede = "60ch",
  id,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  dark?: boolean;
  align?: "left" | "center";
  maxTitle?: string;
  maxLede?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        textAlign: align,
        alignItems: align === "center" ? "center" : "flex-start",
      }}
    >
      {eyebrow && (
        <Reveal delay={0}>
          <Eyebrow dark={dark}>{eyebrow}</Eyebrow>
        </Reveal>
      )}
      <Reveal delay={80}>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "var(--fs-h2)",
            lineHeight: 1.08,
            letterSpacing: "-.02em",
            margin: 0,
            maxWidth: maxTitle,
            textWrap: "balance" as CSSProperties["textWrap"],
            color: dark ? "var(--color-text-inv)" : "var(--color-text-strong)",
          }}
        >
          {title}
        </h2>
      </Reveal>
      {lede && (
        <Reveal delay={160}>
          <p
            style={{
              margin: 0,
              fontSize: "var(--fs-body-lg)",
              lineHeight: 1.55,
              maxWidth: maxLede,
              color: dark ? "rgba(255,255,255,.72)" : "var(--color-text-muted)",
            }}
          >
            {lede}
          </p>
        </Reveal>
      )}
    </div>
  );
}
