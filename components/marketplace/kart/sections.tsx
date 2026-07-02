import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/* ── Brand row: heading + "view all" + logo/monogram tiles ── */
export type KartBrand = { id: string; name: string; logo?: string | null };

export async function KartBrandRow({
  brands,
  locale,
}: {
  brands: KartBrand[];
  locale: Locale;
}) {
  if (brands.length === 0) return null;
  const t = await getTranslations({
    locale,
    namespace: "marketplace.brandStrip",
  });
  return (
    <div>
      <div className="kart-head">
        <h2>{t("title")}</h2>
        <Link href="/kart/brands" className="kart-more">
          {t("viewAll")}
          <ArrowRight size={15} aria-hidden />
        </Link>
      </div>
      <div className="kart-brands">
        {brands.map((b) => {
          const monogram =
            b.name
              .replace(/[^\p{L}\p{N}]/gu, "")
              .slice(0, 2)
              .toUpperCase() || "•";
          return (
            <Link
              key={b.id}
              href={`/kart/shop?brand=${b.id}`}
              className="kart-brand"
              aria-label={b.name}
              title={b.name}
            >
              {b.logo ? (
                <span className="kart-brand-logo">
                  <Image
                    src={b.logo}
                    alt={b.name}
                    fill
                    sizes="150px"
                    style={{ objectFit: "contain" }}
                  />
                </span>
              ) : (
                <span className="kart-brand-mono">{monogram}</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ── Help bento: 1 large image card + 2 small (asymmetric) ── */
export async function KartHelpBento({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "marketplace.support" });
  // TODO(assets): /public placeholders — swap for final photography.
  const large = {
    href: "/contact",
    image: "/smiling-medical-team-portrait.jpeg",
    title: t("humanTitle"),
    note: t("humanNote"),
    cta: t("humanCta"),
  };
  const small = [
    {
      href: "/contact",
      image: "/nurse-holding-patient-hand-reassurance.jpeg",
      title: t("returnsTitle"),
      cta: t("returnsCta"),
    },
    {
      href: "/medtrade",
      image: "/empty-hospital-ward-beds-by-windows.jpeg",
      title: t("bulkTitle"),
      cta: t("bulkCta"),
    },
  ];
  return (
    <div className="kart-help">
      <Link href={large.href} className="kart-help-lg kart-tile">
        <Image
          src={large.image}
          alt=""
          fill
          sizes="(max-width: 900px) 100vw, 560px"
          style={{ objectFit: "cover" }}
        />
        <span className="kart-tile-scrim" aria-hidden />
        <span className="kart-tile-arrow" aria-hidden>
          <ArrowRight size={16} />
        </span>
        <div className="kart-tile-copy">
          <h3>{large.title}</h3>
          <p>{large.note}</p>
          <span className="kart-tile-cta">
            {large.cta}
            <ArrowRight size={14} aria-hidden />
          </span>
        </div>
      </Link>
      <div className="kart-help-col">
        {small.map((s) => (
          <Link key={s.title} href={s.href} className="kart-help-sm kart-tile">
            <Image
              src={s.image}
              alt=""
              fill
              sizes="(max-width: 900px) 100vw, 280px"
              style={{ objectFit: "cover" }}
            />
            <span className="kart-tile-scrim" aria-hidden />
            <span className="kart-tile-arrow" aria-hidden>
              <ArrowRight size={14} />
            </span>
            <div className="kart-tile-copy">
              <h3>{s.title}</h3>
              <span className="kart-tile-cta">
                {s.cta}
                <ArrowRight size={13} aria-hidden />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
