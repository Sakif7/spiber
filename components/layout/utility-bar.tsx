import { useTranslations } from "next-intl";

import { Container } from "@/components/ui";
import { SOCIALS } from "./social-links";

export function UtilityBar() {
  const t = useTranslations("utilityBar");
  return (
    <div
      style={{
        background: "var(--slate-900)",
        color: "rgba(255,255,255,.78)",
        fontSize: 12,
        fontFamily: "var(--font-mono)",
        letterSpacing: ".02em",
        borderBottom: "1px solid rgba(255,255,255,.08)",
      }}
    >
      <Container
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBlock: 9,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 22,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <a
            href="mailto:info@spibermed.com"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden
            >
              <path
                d="M2 3h10v8H2z M2 3l5 4 5-4"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
            info@spibermed.com
          </a>
          <a
            href="tel:+8801346092798"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden
            >
              <path
                d="M2 3a1 1 0 0 1 1-1h2l1.5 3-2 1c.5 2 2 3.5 4 4l1-2 3 1.5V12a1 1 0 0 1-1 1A10 10 0 0 1 2 3z"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinejoin="round"
              />
            </svg>
            +8801346092798
          </a>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              opacity: 0.6,
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden
            >
              <path d="M7 1v12 M1 7h12" stroke="currentColor" strokeWidth="1" />
            </svg>
            {t("location")}
          </span>
        </div>
        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
          <span style={{ opacity: 0.7 }}>{t("hours")}</span>
          <span style={{ display: "flex", gap: 8 }}>
            {SOCIALS.map((s) => (
              <span
                key={s.key}
                title={s.label}
                aria-label={s.label}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  display: "grid",
                  placeItems: "center",
                  background: "rgba(255,255,255,.06)",
                  color: "rgba(255,255,255,.85)",
                }}
              >
                {s.icon(11)}
              </span>
            ))}
          </span>
        </div>
      </Container>
    </div>
  );
}
