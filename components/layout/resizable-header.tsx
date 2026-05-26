"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Arrow, Container } from "@/components/ui";
import {
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
  NavBody,
  NavItems,
  Navbar,
} from "@/components/ui/resizable-navbar";

const NAV_ITEMS = [
  { name: "Home", link: "/" },
  { name: "Products & Solutions", link: "#" },
  { name: "Services", link: "#" },
  { name: "Jupyter Platform", link: "#" },
  { name: "Blogs", link: "#" },
  { name: "About", link: "#" },
];

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

export function ResizableHeader() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<"EN" | "বাং">("EN");
  const [megaOpen, setMegaOpen] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setMegaOpen(null), 140);
  };
  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const openMega = (name: string | null) => {
    cancelClose();
    if (name && MEGA_MENUS[name]) setMegaOpen(name);
    else setMegaOpen(null);
  };

  return (
    <Navbar>
      <NavBody>
        <Logo />
        <NavItems
          items={NAV_ITEMS}
          onItemHover={(name) => (name ? openMega(name) : scheduleClose())}
          onItemClick={() => setOpen(false)}
        />
        <DesktopActions lang={lang} setLang={setLang} />
      </NavBody>

      <MegaMenu open={megaOpen} onMouseEnter={cancelClose} onMouseLeave={scheduleClose} />

      <MobileNav>
        <MobileNavHeader>
          <Logo />
          <MobileNavToggle isOpen={open} onClick={() => setOpen((o) => !o)} />
        </MobileNavHeader>
        <MobileNavMenu isOpen={open} onClose={() => setOpen(false)}>
          {NAV_ITEMS.map((it) => (
            <a
              key={it.name}
              href={it.link}
              onClick={() => setOpen(false)}
              style={{
                fontSize: 15,
                fontWeight: 500,
                color: "var(--color-text-strong)",
                padding: "8px 4px",
                width: "100%",
              }}
            >
              {it.name}
            </a>
          ))}
          <div style={{ display: "flex", gap: 10, marginTop: 10, width: "100%" }}>
            <a
              href="#"
              style={{
                flex: 1,
                textAlign: "center",
                padding: "10px 14px",
                borderRadius: 999,
                border: "1px solid var(--color-border)",
                fontSize: 13,
                color: "var(--color-text)",
              }}
            >
              Login
            </a>
            <CtaButton style={{ flex: 1, justifyContent: "center" }} />
          </div>
        </MobileNavMenu>
      </MobileNav>
    </Navbar>
  );
}

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
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className="hidden lg:block"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 14,
            zIndex: 70,
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.96)",
              backdropFilter: "saturate(180%) blur(20px)",
              WebkitBackdropFilter: "saturate(180%) blur(20px)",
              border: "1px solid var(--color-hairline)",
              borderRadius: 24,
              boxShadow:
                "0 1px 2px rgba(10,31,44,.05), 0 32px 80px -24px rgba(10,31,44,.22), 0 0 0 1px rgba(10,31,44,.04)",
              maxWidth: 1240,
              marginInline: "auto",
              overflow: "hidden",
            }}
          >
            <Container style={{ paddingBlock: 36 }}>
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
          </div>
          <style>{`.mega-link:hover { color: var(--color-brand); }`}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Logo() {
  return (
    <a
      href="/"
      className="relative z-20 flex items-center"
      style={{ paddingInline: 4 }}
      aria-label="SPIBER MED"
    >
      <Image
        src="/spibermed-logo.png"
        alt="SPIBER MED"
        width={1007}
        height={301}
        priority
        style={{ height: 30, width: "auto", display: "block" }}
      />
    </a>
  );
}

function DesktopActions({
  lang,
  setLang,
}: {
  lang: "EN" | "বাং";
  setLang: (l: "EN" | "বাং") => void;
}) {
  return (
    <div
      className="relative z-20"
      style={{ display: "flex", alignItems: "center", gap: 10 }}
    >
      <LangToggle lang={lang} setLang={setLang} />
      <a
        href="#"
        style={{
          fontSize: 13,
          color: "var(--color-text-muted)",
          padding: "8px 10px",
          cursor: "pointer",
        }}
      >
        Login
      </a>
      <CtaButton />
    </div>
  );
}

function LangToggle({
  lang,
  setLang,
}: {
  lang: "EN" | "বাং";
  setLang: (l: "EN" | "বাং") => void;
}) {
  const langs = ["EN", "বাং"] as const;
  return (
    <div
      style={{
        position: "relative",
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
      {langs.map((l) => {
        const active = lang === l;
        return (
          <button
            key={l}
            onClick={() => setLang(l)}
            style={{
              position: "relative",
              background: "transparent",
              color: active ? "var(--color-text-strong)" : "var(--color-text-muted)",
              border: "none",
              borderRadius: 999,
              padding: "5px 12px",
              cursor: "pointer",
              fontFamily: l === "বাং" ? "var(--font-bn)" : "var(--font-mono)",
              transition: "color 200ms",
              zIndex: 1,
            }}
          >
            {active && (
              <motion.span
                layoutId="lang-pill"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 999,
                  background: "var(--color-surface)",
                  boxShadow: "var(--shadow-xs)",
                  zIndex: -1,
                }}
              />
            )}
            {l}
          </button>
        );
      })}
    </div>
  );
}

function CtaButton({ style }: { style?: React.CSSProperties }) {
  return (
    <motion.a
      href="#"
      whileHover={{ y: -2 }}
      whileTap={{ y: 0, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 26 }}
      style={{
        background: "var(--color-brand)",
        color: "white",
        borderRadius: 999,
        padding: "10px 18px",
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        boxShadow: "var(--shadow-brand)",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        textDecoration: "none",
        ...style,
      }}
    >
      Request a Quote <Arrow />
    </motion.a>
  );
}
