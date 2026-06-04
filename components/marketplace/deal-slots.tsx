import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { localize, type Localized } from "@/lib/schemas/localized";
import type { Locale } from "@/i18n/routing";

export type DealBanner = {
  id: string;
  title: Localized;
  subtitle?: Localized;
  image?: string;
  href?: string;
};

/** Promotional "deal" cards row. Renders nothing when there are no deals. */
export function DealSlots({
  deals,
  locale,
}: {
  deals: DealBanner[];
  locale: Locale;
}) {
  if (deals.length === 0) return null;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "var(--s-4)",
      }}
    >
      {deals.map((d) => {
        const inner = (
          <div
            style={{
              position: "relative",
              minHeight: 150,
              borderRadius: "var(--r-lg)",
              overflow: "hidden",
              border: "1px solid var(--color-border)",
              background:
                "linear-gradient(135deg, var(--color-secondary-soft, var(--color-brand-soft)), var(--color-surface))",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              padding: "var(--s-4)",
            }}
          >
            {d.image && (
              <Image
                src={d.image}
                alt=""
                fill
                style={{ objectFit: "cover", opacity: 0.9 }}
                sizes="33vw"
              />
            )}
            <div style={{ position: "relative", display: "grid", gap: 4 }}>
              <strong
                style={{
                  color: "var(--color-text-strong)",
                  fontSize: "var(--fs-h6)",
                }}
              >
                {localize(d.title, locale)}
              </strong>
              {d.subtitle && (
                <span
                  style={{
                    color: "var(--color-text-muted)",
                    fontSize: "var(--fs-body-sm)",
                  }}
                >
                  {localize(d.subtitle, locale)}
                </span>
              )}
            </div>
          </div>
        );
        return d.href ? (
          <Link key={d.id} href={d.href} style={{ textDecoration: "none" }}>
            {inner}
          </Link>
        ) : (
          <div key={d.id}>{inner}</div>
        );
      })}
    </div>
  );
}
