import { CSSProperties, ReactNode } from "react";

export function Eyebrow({
  children,
  dark,
  style,
}: {
  children: ReactNode;
  dark?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: ".18em",
        textTransform: "uppercase",
        color: dark ? "var(--teal-300)" : "var(--color-brand-deep)",
        ...style,
      }}
    >
      <span style={{ width: 18, height: 1, background: "currentColor", opacity: 0.7 }} />
      {children}
    </div>
  );
}
