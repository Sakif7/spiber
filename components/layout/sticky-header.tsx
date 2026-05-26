"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { Arrow, Container } from "@/components/ui";
import { useMagnetic } from "@/hooks";

/* ----- Mega-menu configuration ---------------------------------- */
type MegaConfig = {
  columns: { title: string; items: string[] }[];
  feature: { tag: string; title: string; body: string };
};
const MEGA_MENUS: Record<string, MegaConfig> = {
  "Products & Solutions": {
    columns: [
      { title: "Hospital-Wide", items: ["Medical Furniture", "Disposable Devices"] },
      {
        title: "Patient Care",
        items: ["Patient Monitoring", "Electrocardiogram (ECG)", "Infusion Pumps"],
      },
      { title: "Critical Care", items: ["ICU", "NICU", "CCU"] },
      {
        title: "OR Solution",
        items: ["Operating Tables", "Surgical Lights", "Anesthesia", "Electrosurgery (ESU)"],
      },
      {
        title: "Imaging",
        items: ["Ultrasound", "Radiography", "C-Arm", "CT · MRI · Mammography"],
      },
    ],
    feature: {
      tag: "FEATURED · IMAGING",
      title: "Mobile C-Arm SXR-200",
      body: "High-resolution intraoperative imaging — 1.5kW pulsed output. CE marked, DGDA registered.",
    },
  },
  Services: {
    columns: [
      {
        title: "Hospital Planning & Design",
        items: ["Feasibility Study", "Master Planning", "Turn-Key EPC", "Architectural Review"],
      },
      {
        title: "Hospital Management",
        items: ["Equipment Planning", "Commissioning", "Business Development"],
      },
      {
        title: "Global Employability",
        items: ["Doctors", "Registered Nurses", "Caregivers"],
      },
      {
        title: "Medical Tourism",
        items: ["Hospital Network", "Specialties", "Visa Assistance", "Accommodation"],
      },
    ],
    feature: {
      tag: "NEW · 2026",
      title: "Skill Development Program",
      body: "SPINE — Future Skills Bangladesh. Accredited training for the next generation of clinicians.",
    },
  },
  "Jupyter Platform": {
    columns: [
      {
        title: "HealthHub HIS",
        items: ["EMR / EHR", "Pharmacy & Inventory", "Telemedicine", "Patient Portal"],
      },
      {
        title: "Future Skills BD",
        items: ["Doctors Program", "RN Program", "Caregiver Training"],
      },
    ],
    feature: {
      tag: "DIGITAL",
      title: "One platform · end-to-end",
      body: "From admission to discharge, billing to analytics. Hosted in Bangladesh, integrated with insurance partners.",
    },
  },
  About: {
    columns: [
      {
        title: "Who We Are",
        items: ["Top Message", "Corporate Philosophy", "SPIBER at a Glance", "Vision 2040"],
      },
      { title: "People", items: ["Leadership", "Career", "Gallery"] },
      { title: "Partners", items: ["Hospital Network", "OEM Partners", "Academic Network"] },
    ],
    feature: {
      tag: "VISION",
      title: "Design the Future · 2040",
      body: "Our long-term roadmap toward an accessible, evidence-driven healthcare system across Bangladesh.",
    },
  },
};

function MegaMenu({
  open,
  onMouseEnter,
  onMouseLeave,
}: {
  open: string | null;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const config = open ? MEGA_MENUS[open] : null;
  return (
    <AnimatePresence>
      {config && (
        <motion.div
          key={open}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "rgba(255,255,255,0.96)",
            backdropFilter: "saturate(180%) blur(20px)",
            WebkitBackdropFilter: "saturate(180%) blur(20px)",
            borderTop: "1px solid var(--color-hairline)",
            borderBottom: "1px solid var(--color-hairline)",
            boxShadow: "0 20px 40px -16px rgba(10,19,24,.16)",
            zIndex: 100,
          }}
        >
          <Container style={{ paddingBlock: 40 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${config.columns.length}, 1fr) 1.2fr`,
                gap: 36,
              }}
            >
              {config.columns.map((c) => (
                <div key={c.title}>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      fontWeight: 500,
                      letterSpacing: ".14em",
                      textTransform: "uppercase",
                      color: "var(--color-brand-deep)",
                      marginBottom: 14,
                    }}
                  >
                    {c.title}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    {c.items.map((it) => (
                      <a
                        key={it}
                        href="#"
                        className="mega-link"
                        style={{
                          fontSize: 14,
                          color: "var(--color-text)",
                          cursor: "pointer",
                          padding: "3px 0",
                          transition: "color 160ms",
                        }}
                      >
                        {it}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
              <div
                style={{
                  background:
                    "linear-gradient(160deg, var(--teal-50), var(--color-surface))",
                  border: "1px solid var(--teal-100)",
                  borderRadius: "var(--r-lg)",
                  padding: 22,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    fontWeight: 500,
                    letterSpacing: ".16em",
                    color: "var(--color-secondary)",
                    marginBottom: 12,
                  }}
                >
                  {config.feature.tag}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 18,
                    fontWeight: 600,
                    letterSpacing: "-.01em",
                    color: "var(--color-text-strong)",
                    marginBottom: 8,
                  }}
                >
                  {config.feature.title}
                </div>
                <div
                  style={{ fontSize: 13, lineHeight: 1.55, color: "var(--color-text-muted)" }}
                >
                  {config.feature.body}
                </div>
                <a
                  href="#"
                  style={{
                    marginTop: 14,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--color-brand-deep)",
                    cursor: "pointer",
                  }}
                >
                  Learn more <Arrow size={12} />
                </a>
              </div>
            </div>
          </Container>
          <style>{`
            .mega-link:hover { color: var(--color-brand); }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function StickyHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [lang, setLang] = useState<"EN" | "বাং">("EN");
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cta = useMagnetic<HTMLButtonElement>(0.25, 80);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onEnter = (item: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (MEGA_MENUS[item]) setOpen(item);
    else setOpen(null);
  };
  const onLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(null), 140);
  };

  const NavItem = ({
    label,
    hasMenu,
    active,
  }: {
    label: string;
    hasMenu?: boolean;
    active?: boolean;
  }) => (
    <button
      onMouseEnter={() => onEnter(label)}
      onFocus={() => onEnter(label)}
      onMouseLeave={onLeave}
      style={{
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: "26px 0",
        fontFamily: "var(--font-body)",
        fontWeight: 500,
        fontSize: 14,
        color: "var(--color-text)",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        position: "relative",
      }}
    >
      {label}
      {hasMenu && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
          <path d="M2.5 4l2.5 2.5L7.5 4" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      )}
      {(active || open === label) && (
        <span
          style={{
            position: "absolute",
            left: 0,
            right: 14,
            bottom: 18,
            height: 2,
            background: "var(--color-brand)",
            borderRadius: 2,
          }}
        />
      )}
    </button>
  );

  return (
    <header
      onMouseLeave={onLeave}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: scrolled ? "rgba(255,255,255,.78)" : "rgba(255,255,255,.96)",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        borderBottom: "1px solid " + (scrolled ? "rgba(10,19,24,.06)" : "transparent"),
        boxShadow: scrolled ? "0 10px 30px -20px rgba(10,19,24,.18)" : "none",
        transition: "all 280ms cubic-bezier(.16,1,.3,1)",
      }}
    >
      <Container
        style={{
          display: "flex",
          alignItems: "center",
          gap: 32,
          height: scrolled ? 62 : 76,
          transition: "height 280ms cubic-bezier(.16,1,.3,1)",
        }}
      >
        <a href="#" style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <Image
            src="/spibermed-logo.png"
            alt="SPIBER MED"
            width={140}
            height={40}
            priority
            style={{
              height: scrolled ? 30 : 38,
              width: "auto",
              transition: "height 280ms",
            }}
          />
        </a>

        <nav
          style={{
            display: "flex",
            gap: 28,
            flex: 1,
            alignItems: "stretch",
            flexWrap: "wrap",
          }}
        >
          <NavItem label="Home" active />
          <NavItem label="Products & Solutions" hasMenu />
          <NavItem label="Services" hasMenu />
          <NavItem label="Jupyter Platform" hasMenu />
          <NavItem label="Blogs" />
          <NavItem label="About" hasMenu />
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              display: "inline-flex",
              padding: 3,
              borderRadius: 999,
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {(["EN", "বাং"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                style={{
                  background: lang === l ? "var(--color-surface)" : "transparent",
                  color: lang === l ? "var(--color-text-strong)" : "var(--color-text-muted)",
                  border: "none",
                  borderRadius: 999,
                  padding: "5px 12px",
                  cursor: "pointer",
                  boxShadow: lang === l ? "var(--shadow-xs)" : "none",
                  fontFamily: l === "বাং" ? "var(--font-bn)" : "var(--font-mono)",
                  transition: "all 200ms",
                }}
              >
                {l}
              </button>
            ))}
          </div>

          <a
            href="#"
            style={{
              fontSize: 13,
              color: "var(--color-text-muted)",
              padding: "8px 12px",
              cursor: "pointer",
            }}
          >
            Login
          </a>

          <button
            ref={cta}
            style={{
              background: "var(--color-brand)",
              color: "white",
              border: "none",
              borderRadius: 999,
              padding: "12px 20px",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              boxShadow: "var(--shadow-brand)",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Request a Quote <Arrow />
          </button>
        </div>
      </Container>

      <MegaMenu
        open={open}
        onMouseEnter={() => closeTimer.current && clearTimeout(closeTimer.current)}
        onMouseLeave={onLeave}
      />
    </header>
  );
}
