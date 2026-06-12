import { CSSProperties, ReactNode } from "react";

export function Section({
  children,
  dark,
  mesh,
  id,
  style,
  py = "clamp(48px, 7.5vw, 128px)",
}: {
  children: ReactNode;
  dark?: boolean;
  mesh?: boolean;
  id?: string;
  style?: CSSProperties;
  py?: string;
}) {
  return (
    <section
      id={id}
      className="app-section"
      style={{
        position: "relative",
        paddingBlock: py,
        background: dark ? "var(--color-surface-inv)" : "transparent",
        color: dark ? "var(--color-text-inv)" : "var(--color-text)",
        overflow: "hidden",
        ...style,
      }}
    >
      {mesh && (
        <div
          className="mesh"
          style={{
            position: "absolute",
            inset: 0,
            opacity: dark ? 0.35 : 0.18,
          }}
        />
      )}
      <div style={{ position: "relative" }}>{children}</div>
    </section>
  );
}
