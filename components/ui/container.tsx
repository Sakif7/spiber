import { CSSProperties, ReactNode } from "react";

export function Container({
  children,
  style,
  narrow,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  narrow?: boolean;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        width: "100%",
        maxWidth: narrow ? 980 : "var(--container-max)",
        marginInline: "auto",
        paddingInline: "var(--container-pad)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
