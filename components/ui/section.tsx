import { CSSProperties, ReactNode } from "react";
import { DotPattern } from "./dot-pattern";

export function Section({
  children,
  dark,
  mesh,
  dots,
  id,
  style,
  py = "clamp(72px, 8vw, 128px)",
}: {
  children: ReactNode;
  dark?: boolean;
  mesh?: boolean;
  dots?: boolean;
  id?: string;
  style?: CSSProperties;
  py?: string;
}) {
  return (
    <section
      id={id}
      style={{
        position: "relative",
        paddingBlock: py,
        background: dark ? "var(--color-surface-inv)" : "transparent",
        color: dark ? "var(--color-text-inv)" : "var(--color-text)",
        overflow: "hidden",
        ...style,
      }}
    >
      {dots && (
        <DotPattern
          color={dark ? "rgba(110,196,190,0.12)" : "var(--teal-300)"}
          dotSize={1.5}
          gap={24}
          fade="none"
          style={{ opacity: dark ? 1 : 0.55 }}
        />
      )}
      {mesh && (
        <div
          className="mesh"
          style={{ position: "absolute", inset: 0, opacity: dark ? 0.35 : 0.18 }}
        />
      )}
      <div style={{ position: "relative" }}>{children}</div>
    </section>
  );
}
