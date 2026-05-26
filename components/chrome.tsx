"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { Arrow, Container, Eyebrow, Reveal, Section, useMagnetic } from "./primitives";

/* ============================================================
   Utility Bar — thin top strip
   ============================================================ */
export function UtilityBar() {
  return (
    <div
      style={{
        background: "var(--slate-900)",
        color: "rgba(255,255,255,.78)",
        fontSize: 12,
        fontFamily: "var(--font-mono)",
        letterSpacing: ".02em",
        borderBottom: "1px solid rgba(255,255,255,.08)",
      }}
    >
      <Container
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBlock: 9,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
          <a
            href="mailto:info@spiberhcl.com"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M2 3h10v8H2z M2 3l5 4 5-4" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            info@spiberhcl.com
          </a>
          <a
            href="tel:+8801765193751"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path
                d="M2 3a1 1 0 0 1 1-1h2l1.5 3-2 1c.5 2 2 3.5 4 4l1-2 3 1.5V12a1 1 0 0 1-1 1A10 10 0 0 1 2 3z"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinejoin="round"
              />
            </svg>
            +8801765193751
          </a>
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 6, opacity: 0.6 }}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M7 1v12 M1 7h12" stroke="currentColor" strokeWidth="1" />
            </svg>
            Banani · Dhaka 1213, Bangladesh
          </span>
        </div>
        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
          <span style={{ opacity: 0.7 }}>Mon–Sat · 09:00–18:00 BST</span>
          <span style={{ display: "flex", gap: 8 }}>
            {["fb", "x", "in", "ig"].map((s) => (
              <span
                key={s}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  display: "grid",
                  placeItems: "center",
                  background: "rgba(255,255,255,.06)",
                  fontSize: 9,
                  textTransform: "uppercase",
                }}
              >
                {s}
              </span>
            ))}
          </span>
        </div>
      </Container>
    </div>
  );
}

/* ============================================================
   Mega Menu config
   ============================================================ */
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

/* ============================================================
   Sticky Header
   ============================================================ */
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
            src="/spibermed-logo.jpeg"
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

/* ============================================================
   CTA Band — pre-footer call to action
   ============================================================ */
export function CTABand() {
  const cta = useMagnetic<HTMLButtonElement>(0.3, 100);
  return (
    <Section dark mesh py="clamp(80px, 9vw, 160px)">
      <Container>
        <div
          className="equal-2col"
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            gap: 48,
            alignItems: "center",
          }}
        >
          <div>
            <Reveal>
              <Eyebrow dark>GET IN TOUCH</Eyebrow>
            </Reveal>
            <Reveal delay={100}>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 500,
                  fontSize: "var(--fs-display)",
                  lineHeight: 1.02,
                  letterSpacing: "-.03em",
                  margin: "16px 0 24px",
                  maxWidth: "16ch",
                  textWrap: "balance" as CSSProperties["textWrap"],
                  color: "white",
                }}
              >
                Contact us for help with your business.
              </h2>
            </Reveal>
            <Reveal delay={200}>
              <p
                style={{
                  fontSize: 18,
                  lineHeight: 1.55,
                  color: "rgba(255,255,255,.7)",
                  maxWidth: "52ch",
                  margin: 0,
                }}
              >
                Whether you&apos;re commissioning a new ICU, building a hospital from scratch, or planning your team&apos;s continued education — our specialists respond within 2 business hours.
              </p>
            </Reveal>
          </div>
          <Reveal delay={300}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                alignItems: "flex-start",
              }}
            >
              <button
                ref={cta}
                style={{
                  background: "var(--color-brand)",
                  color: "white",
                  border: "none",
                  borderRadius: 999,
                  padding: "18px 28px",
                  fontSize: 16,
                  fontWeight: 500,
                  cursor: "pointer",
                  boxShadow: "var(--shadow-brand)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                Request a Quote <Arrow size={16} />
              </button>
              <button
                style={{
                  background: "transparent",
                  color: "white",
                  border: "1px solid rgba(255,255,255,.24)",
                  borderRadius: 999,
                  padding: "16px 26px",
                  fontSize: 15,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                Schedule a Call <Arrow />
              </button>
              <a
                href="mailto:sales@spiberhcl.com"
                style={{
                  marginTop: 8,
                  fontSize: 14,
                  color: "var(--teal-300)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                Or email us · sales@spiberhcl.com →
              </a>
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}

/* ============================================================
   Footer
   ============================================================ */
export function Footer() {
  return (
    <footer
      style={{
        background: "var(--slate-900)",
        color: "white",
        paddingBlock: 64,
        borderTop: "1px solid rgba(255,255,255,.08)",
      }}
    >
      <Container>
        <div
          className="footer-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1.2fr",
            gap: 36,
            paddingBottom: 40,
            borderBottom: "1px solid rgba(255,255,255,.10)",
          }}
        >
          <div>
            <Image
              src="/spibermed-logo.jpeg"
              alt="SPIBER MED"
              width={180}
              height={52}
              style={{
                height: 52,
                width: "auto",
                filter: "brightness(1.6)",
                mixBlendMode: "screen",
                marginBottom: 18,
              }}
            />
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: "rgba(255,255,255,.7)",
                maxWidth: 320,
              }}
            >
              Empowering healthcare in Bangladesh — clinical-grade equipment, planning, training, and lifelong service.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              {["fb", "x", "in", "ig"].map((s) => (
                <a
                  key={s}
                  href="#"
                  className="footer-social"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,.16)",
                    display: "grid",
                    placeItems: "center",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "rgba(255,255,255,.8)",
                    cursor: "pointer",
                    transition: "all 200ms",
                  }}
                >
                  {s}
                </a>
              ))}
            </div>
          </div>

          {(
            [
              ["Products", ["Patient Care", "Critical Care", "OR Solutions", "Surgical", "Imaging", "Lab Diagnostics"]],
              ["Services", ["Hospital Planning", "EPC Delivery", "Healthcare IT", "Global Employment", "Medical Tourism"]],
              ["Company", ["Who We Are", "Top Message", "Vision 2040", "Career", "Gallery", "Contact"]],
            ] as const
          ).map(([title, items]) => (
            <div key={title}>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: "var(--teal-300)",
                  marginBottom: 16,
                }}
              >
                {title}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {items.map((i) => (
                  <a
                    key={i}
                    href="#"
                    className="footer-link"
                    style={{
                      fontSize: 14,
                      color: "rgba(255,255,255,.78)",
                      cursor: "pointer",
                      transition: "color 160ms",
                    }}
                  >
                    {i}
                  </a>
                ))}
              </div>
            </div>
          ))}

          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "var(--teal-300)",
                marginBottom: 16,
              }}
            >
              Stay Informed
            </div>
            <div
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,.7)",
                marginBottom: 14,
                lineHeight: 1.55,
              }}
            >
              Monthly catalog and new-arrival updates.
            </div>
            <NewsletterForm />
            <div
              style={{
                marginTop: 22,
                fontSize: 13,
                lineHeight: 1.7,
                color: "rgba(255,255,255,.7)",
              }}
            >
              <div style={{ marginBottom: 10 }}>
                Road-06, House-47, Level-01, Block-C,
                <br />
                Banani, Dhaka-1213, Bangladesh
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                +880 1765 193751
                <br />
                +880 1711 739797
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  marginTop: 8,
                  color: "var(--teal-300)",
                }}
              >
                info@spiberhcl.com
                <br />
                sales@spiberhcl.com
                <br />
                inquiry@spiberhcl.com
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 24,
            color: "rgba(255,255,255,.5)",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            letterSpacing: ".02em",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>© 2026 SPIBER MED LTD. ALL RIGHTS RESERVED.</div>
          <div style={{ display: "flex", gap: 24 }}>
            <a href="#">PRIVACY</a>
            <a href="#">TERMS</a>
            <a href="#">COOKIES</a>
            <a href="#">SITEMAP</a>
          </div>
        </div>
      </Container>

      <style>{`
        .footer-social:hover { background: var(--color-brand); border-color: var(--color-brand) !important; }
        .footer-link:hover { color: var(--teal-300); }
        @media (max-width: 980px) {
          .footer-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 600px) {
          .footer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </footer>
  );
}

function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStatus(res.ok ? "ok" : "error");
      if (res.ok) setEmail("");
    } catch {
      setStatus("error");
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "flex",
        background: "rgba(255,255,255,.06)",
        border: "1px solid rgba(255,255,255,.16)",
        borderRadius: 999,
        padding: 4,
      }}
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@hospital.bd"
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          padding: "10px 14px",
          fontSize: 13,
          color: "white",
          outline: "none",
          fontFamily: "var(--font-body)",
        }}
      />
      <button
        type="submit"
        disabled={status === "sending"}
        style={{
          background: "var(--color-brand)",
          color: "white",
          border: "none",
          padding: "8px 16px",
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 500,
          cursor: status === "sending" ? "wait" : "pointer",
          opacity: status === "sending" ? 0.7 : 1,
        }}
      >
        {status === "ok" ? "Subscribed" : status === "sending" ? "…" : "Subscribe"}
      </button>
    </form>
  );
}
