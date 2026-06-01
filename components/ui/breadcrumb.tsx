import { Link } from "@/i18n/navigation";

export type Crumb = { label: string; href?: string };

/** Accessible breadcrumb trail; the last item is rendered as the current page. */
export function Breadcrumb({ items }: { items: Crumb[] }) {
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
          color: "var(--color-text-muted)",
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
                <Link
                  href={item.href}
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  style={{
                    color: last ? "var(--color-text-strong)" : undefined,
                  }}
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
