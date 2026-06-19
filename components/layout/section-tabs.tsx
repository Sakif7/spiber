"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/cn";

export type SectionTab = {
  label: string;
  href: string;
  /** Extra path prefixes that also mark this tab active (e.g. detail routes). */
  match?: string[];
  /** Active only on an exact match (use for a section root like `/tourism`). */
  exact?: boolean;
};

function isActive(path: string, tab: SectionTab) {
  if (tab.exact) return path === tab.href;
  const prefixes = [tab.href, ...(tab.match ?? [])];
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Interior-page sub-navigation: a horizontal strip of sibling-page links with
 * the current page highlighted, so users always know where they are within a
 * section. `usePathname()` (locale-stripped) drives the active state.
 */
export function SectionTabs({
  items,
  tone = "teal",
  ariaLabel,
}: {
  items: SectionTab[];
  tone?: "teal" | "orange";
  ariaLabel: string;
}) {
  const path = usePathname();
  const accent =
    tone === "orange" ? "var(--color-secondary)" : "var(--brand-teal)";
  const accentText =
    tone === "orange" ? "var(--color-secondary)" : "var(--color-brand-deep)";

  return (
    <nav
      className="section-tabs"
      aria-label={ariaLabel}
      style={
        {
          "--tab-accent": accent,
          "--tab-accent-text": accentText,
        } as CSSProperties
      }
    >
      <Container>
        <ul className="section-tabs-row">
          {items.map((tab) => {
            const active = isActive(path, tab);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("section-tab", active && "is-active")}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </Container>
    </nav>
  );
}

/** Sub-nav for the Company section interior pages. */
export function CompanyTabs() {
  const t = useTranslations("sectionTabs");
  const items: SectionTab[] = [
    { label: t("company.about"), href: "/company/about" },
    { label: t("company.team"), href: "/company/team" },
    { label: t("company.philosophy"), href: "/company/corporate-philosophy" },
    { label: t("company.vision"), href: "/company/vision-2040" },
    { label: t("company.career"), href: "/company/career" },
    { label: t("company.gallery"), href: "/company/gallery" },
    { label: t("company.events"), href: "/company/events" },
  ];
  return <SectionTabs items={items} tone="teal" ariaLabel={t("companyAria")} />;
}

/** Sub-nav for the Medical Tourism section interior pages. */
export function TourismTabs() {
  const t = useTranslations("sectionTabs");
  const items: SectionTab[] = [
    { label: t("tourism.overview"), href: "/tourism", exact: true },
    { label: t("tourism.medicalTourism"), href: "/tourism/medical-tourism" },
    {
      label: t("tourism.destinations"),
      href: "/tourism/destinations",
      match: ["/tourism/destination"],
    },
    {
      label: t("tourism.hospitals"),
      href: "/tourism/hospitals",
      match: ["/tourism/hospital"],
    },
    {
      label: t("tourism.doctors"),
      href: "/tourism/doctors",
      match: ["/tourism/doctor"],
    },
    {
      label: t("tourism.packages"),
      href: "/tourism/packages",
      match: ["/tourism/package"],
    },
  ];
  return (
    <SectionTabs items={items} tone="orange" ariaLabel={t("tourismAria")} />
  );
}
