import { Link } from "@/i18n/navigation";

export type Crumb = { label: string; href?: string };

/** Accessible breadcrumb trail; the last item is rendered as the current page. */
export function Breadcrumb({
  items,
  tone = "default",
}: {
  items: Crumb[];
  tone?: "default" | "onDark";
}) {
  const dark = tone === "onDark";
  const muted = dark ? "rgba(255,255,255,0.72)" : "var(--color-text-muted)";
  const current = dark ? "#fff" : "var(--color-text-strong)";

  return (
    <nav aria-label="Breadcrumb">
      <ol
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          listStyle: "none",
          margin: 0,
          padding: 0,
          fontFamily: "var(--font-mono)",
          fontSize: "var(--fs-caption)",
          color: muted,
        }}
      >
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li
              key={`${item.label}-${i}`}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              {item.href && !last ? (
                <Link href={item.href} style={{ color: muted }}>
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  style={{ color: last ? current : muted }}
                >
                  {item.label}
                </span>
              )}
              {!last && <span aria-hidden>/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
