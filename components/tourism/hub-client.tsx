"use client";

import { CSSProperties, useRef } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  useReducedMotion,
} from "framer-motion";
import { Link } from "@/i18n/navigation";
import {
  Section,
  Container,
  SectionTitle,
  DotPattern,
  Reveal,
  Arrow,
} from "@/components/ui";
import {
  HeartPulse,
  Globe,
  Briefcase,
  MonitorSmartphone,
  Bone,
  Brain,
  Activity,
  Baby,
  Sparkles,
  FileUp,
  UserCheck,
  Building2,
  Plane,
  HeartHandshake,
  BedDouble,
  FileCheck,
  Car,
  Languages,
  ShieldCheck,
  Check,
  CheckCircle2,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

const ORANGE = "var(--color-secondary)";
const SECTION_PY = "clamp(44px, 5.5vw, 72px)";
const MotionLink = motion.create(Link);

/* ============================================ SERVICE NARRATIVE
   The old 4-up feature-card grid, rebuilt as alternating prose + photo
   narrative blocks (image left/right, staggered reveals). */
const SERVICES: {
  key: string;
  icon: LucideIcon;
  href: string;
  image: string;
}[] = [
  {
    key: "bangladesh",
    icon: HeartPulse,
    href: "/tourism/doctors",
    image: "/tourism-1.png",
  },
  {
    key: "international",
    icon: Globe,
    href: "/tourism/medical-tourism",
    image: "/tourism-2.png",
  },
  {
    key: "travelDesk",
    icon: Briefcase,
    href: "/tourism/air-tickets",
    image: "/tourism-3.png",
  },
  {
    key: "telemedicine",
    icon: MonitorSmartphone,
    href: "/tourism/telemedicine",
    image: "/tourism-4.png",
  },
];

export function ServiceOverview() {
  const t = useTranslations("tourism.services");
  return (
    <Section py={SECTION_PY}>
      <Container>
        <SectionTitle
          eyebrow={t("eyebrow")}
          title={t("heading")}
          lede={t("lede")}
          align="center"
          maxLede="56ch"
        />
        <div className="tourism-narrative" style={{ marginTop: "var(--s-10)" }}>
          {SERVICES.map((s, i) => {
            const Icon = s.icon;
            const items = t.raw(`${s.key}.items`) as string[];
            const reverse = i % 2 === 1;
            return (
              <div
                key={s.key}
                className={`tourism-narrative-row${reverse ? "reverse" : ""}`}
              >
                <Reveal
                  y={28}
                  className="tourism-narrative-media"
                  style={{
                    position: "relative",
                    aspectRatio: "4 / 3",
                    borderRadius: "var(--r-xl)",
                    overflow: "hidden",
                    boxShadow: "var(--shadow-lg)",
                  }}
                >
                  <Image
                    src={s.image}
                    alt={t(`${s.key}.title`)}
                    fill
                    sizes="(max-width: 860px) 92vw, 520px"
                    style={{ objectFit: "cover" }}
                  />
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      top: 16,
                      left: 16,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 46,
                      height: 46,
                      borderRadius: "var(--r-md)",
                      background: "rgba(255,255,255,.92)",
                      color: "var(--color-brand-deep)",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <Icon size={22} aria-hidden />
                  </span>
                </Reveal>

                <Reveal
                  delay={90}
                  className="tourism-narrative-body"
                  style={{ display: "grid", gap: "var(--s-3)" }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      letterSpacing: ".16em",
                      textTransform: "uppercase",
                      color: ORANGE,
                      fontWeight: 600,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")} · {t(`${s.key}.title`)}
                  </span>
                  <h3
                    style={{
                      margin: 0,
                      fontFamily: "var(--font-display)",
                      fontSize: "var(--fs-h3)",
                      lineHeight: 1.12,
                      letterSpacing: "-.018em",
                      color: "var(--color-text-strong)",
                    }}
                  >
                    {t(`${s.key}.title`)}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      color: "var(--color-text-muted)",
                      fontSize: "var(--fs-body-lg)",
                      lineHeight: 1.6,
                      maxWidth: "52ch",
                    }}
                  >
                    {t(`${s.key}.lede`)}
                  </p>
                  <ul
                    className="tourism-narrative-checks"
                    style={{
                      listStyle: "none",
                      margin: "var(--s-2) 0 0",
                      padding: 0,
                    }}
                  >
                    {items.map((it, j) => (
                      <li
                        key={j}
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "flex-start",
                          fontSize: "var(--fs-body-sm)",
                          color: "var(--color-text)",
                        }}
                      >
                        <Check
                          size={15}
                          style={{
                            color: "var(--color-brand)",
                            marginTop: 3,
                            flexShrink: 0,
                          }}
                          aria-hidden
                        />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={s.href}
                    style={{ ...learnMore, marginTop: "var(--s-2)" }}
                  >
                    {t("learnMore")} <ArrowRight size={15} aria-hidden />
                  </Link>
                </Reveal>
              </div>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}

/* ===================================== FEATURED DESTINATIONS
   Home-style image cards (photo background + gradient scrim + circular arrow),
   4-up. Data is fetched server-side and passed in. */
export type DestinationItem = {
  id: string;
  href: string;
  title: string;
  image: string;
};

export function DestinationsGrid({ items }: { items: DestinationItem[] }) {
  const t = useTranslations("tourism");
  return (
    <div className="tourism-destinations" style={{ marginTop: "var(--s-10)" }}>
      {items.map((d, i) => (
        <Reveal key={d.id} delay={i * 60} y={26} style={{ height: "100%" }}>
          <DestinationCard
            href={d.href}
            image={d.image}
            title={d.title}
            subtitle={t("destination.triad")}
            cta={t("destination.explore")}
          />
        </Reveal>
      ))}
    </div>
  );
}

function DestinationCard({
  href,
  image,
  title,
  subtitle,
  cta,
}: {
  href: string;
  image: string;
  title: string;
  subtitle: string;
  cta: string;
}) {
  return (
    <MotionLink
      href={href}
      whileHover="hover"
      initial="rest"
      animate="rest"
      style={{
        position: "relative",
        display: "block",
        height: "100%",
        minHeight: 232,
        borderRadius: 22,
        overflow: "hidden",
        textDecoration: "none",
        color: "#fff",
        background: "var(--slate-900)",
        boxShadow:
          "0 1px 2px rgba(10,31,44,.05), 0 24px 60px -24px rgba(10,31,44,.26), 0 0 0 1px rgba(10,31,44,.05)",
      }}
    >
      <motion.div
        variants={{ rest: { scale: 1 }, hover: { scale: 1.07 } }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: "absolute", inset: 0 }}
      >
        <Image
          src={image}
          alt={title}
          fill
          sizes="(max-width: 760px) 50vw, 300px"
          style={{ objectFit: "cover" }}
        />
      </motion.div>
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(2,8,11,0.04) 0%, rgba(2,8,11,0.26) 44%, rgba(2,8,11,0.84) 100%)",
        }}
      />
      <motion.span
        aria-hidden
        variants={{ rest: { x: 0, y: 0 }, hover: { x: 3, y: -3 } }}
        transition={{ type: "spring", stiffness: 380, damping: 26 }}
        style={{
          position: "absolute",
          top: 14,
          right: 14,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 34,
          height: 34,
          borderRadius: 999,
          background: "rgba(255,255,255,0.94)",
          color: ORANGE,
        }}
      >
        <Arrow size={13} />
      </motion.span>
      <div style={{ position: "absolute", left: 16, right: 16, bottom: 14 }}>
        <h3
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 21,
            letterSpacing: "-.012em",
            lineHeight: 1.1,
            color: "#fff",
          }}
        >
          {title}
        </h3>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 12.5,
            lineHeight: 1.4,
            color: "rgba(255,255,255,.82)",
          }}
        >
          {subtitle}
        </p>
        <span
          style={{
            marginTop: 8,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 12.5,
            fontWeight: 600,
            color: "#fff",
          }}
        >
          {cta} <ArrowRight size={13} aria-hidden />
        </span>
      </div>
    </MotionLink>
  );
}

/* ================================ POPULAR TREATMENTS */
export function PopularTreatments() {
  const t = useTranslations("tourism.treatments");
  const cards: { key: string; icon: LucideIcon }[] = [
    { key: "cardiac", icon: HeartPulse },
    { key: "ortho", icon: Bone },
    { key: "neuro", icon: Brain },
    { key: "oncology", icon: Activity },
    { key: "ivf", icon: Baby },
    { key: "cosmetic", icon: Sparkles },
  ];
  return (
    <Section py={SECTION_PY}>
      <Container>
        <SectionTitle
          title={t("heading")}
          lede={t("lede")}
          align="center"
          maxLede="50ch"
        />
        <div className="tourism-treatments" style={{ marginTop: "var(--s-8)" }}>
          {cards.map((c, i) => {
            const Icon = c.icon;
            return (
              <Reveal key={c.key} delay={i * 60} style={{ height: "100%" }}>
                <Link
                  href={`/tourism/packages?category=${c.key}`}
                  className="tourism-card"
                  style={{
                    ...cardBox,
                    alignItems: "center",
                    textAlign: "center",
                    gap: 8,
                  }}
                >
                  <span style={iconChip}>
                    <Icon size={24} aria-hidden />
                  </span>
                  <strong
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "var(--fs-body)",
                      color: "var(--color-text-strong)",
                    }}
                  >
                    {t(`${c.key}.title`)}
                  </strong>
                  <span
                    style={{
                      color: "var(--color-text-muted)",
                      fontSize: "var(--fs-caption)",
                      flex: 1,
                    }}
                  >
                    {t(`${c.key}.desc`)}
                  </span>
                  <span
                    style={{
                      ...learnMore,
                      marginTop: 2,
                      justifyContent: "center",
                    }}
                  >
                    {t("viewPackage")} <ArrowRight size={13} aria-hidden />
                  </span>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}

/* ================================= HOW IT WORKS — vertical scroll stepper */
const STEPS: { n: string; icon: LucideIcon }[] = [
  { n: "1", icon: FileUp },
  { n: "2", icon: UserCheck },
  { n: "3", icon: Building2 },
  { n: "4", icon: Plane },
  { n: "5", icon: HeartHandshake },
];

export function HowItWorks() {
  const t = useTranslations("tourism.steps");
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 78%", "end 55%"],
  });
  const fillScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <Section
      py={SECTION_PY}
      style={{ background: "var(--color-surface-2, #f7f9fa)" }}
    >
      <Container>
        <SectionTitle
          title={t("heading")}
          lede={t("lede")}
          align="center"
          maxLede="46ch"
        />
        <div
          ref={ref}
          className="tourism-stepper"
          style={{ marginTop: "var(--s-10)" }}
        >
          <span className="tourism-stepper-track" aria-hidden />
          <motion.span
            className="tourism-stepper-fill"
            aria-hidden
            style={{ scaleY: reduced ? 1 : fillScale }}
          />
          {STEPS.map((s) => (
            <Step
              key={s.n}
              n={s.n}
              icon={s.icon}
              title={t(`${s.n}.title`)}
              desc={t(`${s.n}.desc`)}
              reduced={!!reduced}
            />
          ))}
        </div>
      </Container>
    </Section>
  );
}

function Step({
  n,
  icon: Icon,
  title,
  desc,
  reduced,
}: {
  n: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  reduced: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, {
    once: true,
    amount: 0.6,
    margin: "0px 0px -20% 0px",
  });
  const active = reduced || inView;
  return (
    <div ref={ref} className="tourism-step">
      <span
        className="tourism-step-circle"
        data-active={active}
        style={{
          background: active ? "var(--color-brand)" : "var(--color-surface)",
          color: active ? "#fff" : "var(--color-text-muted)",
          borderColor: active ? "var(--color-brand)" : "var(--color-border)",
          boxShadow: active ? "var(--shadow-brand)" : "none",
        }}
      >
        {n}
      </span>
      <motion.div
        initial={false}
        animate={{ opacity: active ? 1 : 0.45, y: active ? 0 : 8 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{ display: "grid", gap: 4, paddingTop: 4 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon
            size={17}
            style={{ color: "var(--color-brand-deep)" }}
            aria-hidden
          />
          <strong
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--fs-body)",
              color: "var(--color-text-strong)",
            }}
          >
            {title}
          </strong>
        </div>
        <span
          style={{
            color: "var(--color-text-muted)",
            fontSize: "var(--fs-body-sm)",
            lineHeight: 1.55,
            maxWidth: "52ch",
          }}
        >
          {desc}
        </span>
      </motion.div>
    </div>
  );
}

/* ============================= TRAVEL & HOSPITALITY SUPPORT */
export function TravelSupport() {
  const t = useTranslations("tourism.support");
  const items: { key: string; icon: LucideIcon }[] = [
    { key: "air", icon: Plane },
    { key: "hotel", icon: BedDouble },
    { key: "visa", icon: FileCheck },
    { key: "airport", icon: Car },
    { key: "translator", icon: Languages },
    { key: "insurance", icon: ShieldCheck },
    { key: "corporate", icon: Briefcase },
  ];
  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        paddingBlock: SECTION_PY,
        background:
          "linear-gradient(135deg, var(--teal-50), #eaf6f7 60%, var(--teal-50))",
      }}
    >
      <Plane
        size={200}
        aria-hidden
        style={{
          position: "absolute",
          right: "-2%",
          top: "50%",
          transform: "translateY(-50%) rotate(-12deg)",
          color: "rgba(9,115,119,.07)",
          pointerEvents: "none",
        }}
      />
      <Container style={{ position: "relative" }}>
        <Reveal
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            marginBottom: "var(--s-8)",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontSize: "var(--fs-h3)",
              color: "var(--color-text-strong)",
            }}
          >
            {t("heading")}
          </h2>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            {t("lede")}
          </p>
        </Reveal>
        <div className="tourism-support-items">
          {items.map((it, i) => {
            const Icon = it.icon;
            return (
              <Reveal
                key={it.key}
                delay={i * 50}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  gap: 8,
                }}
              >
                <span style={supportChip}>
                  <Icon size={22} aria-hidden />
                </span>
                <span
                  style={{
                    fontSize: "var(--fs-caption)",
                    color: "var(--color-text-strong)",
                    fontWeight: 500,
                    lineHeight: 1.35,
                  }}
                >
                  {t(it.key)}
                </span>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

/* =================================== WHY CHOOSE + CTA */
export function WhyChoose() {
  const t = useTranslations("tourism.whyChoose");
  const hub = useTranslations("tourism.hub");
  const points = ["p1", "p2", "p3", "p4", "p5", "p6"] as const;
  return (
    <Section py={SECTION_PY}>
      <Container className="tourism-why">
        <Reveal style={{ display: "grid", gap: "var(--s-5)" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <h2
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontSize: "var(--fs-h3)",
                color: "var(--color-text-strong)",
              }}
            >
              {t("heading")}
            </h2>
            <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
              {t("lede")}
            </p>
          </div>
          <div className="tourism-why-points">
            {points.map((p) => (
              <div
                key={p}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  padding: "12px 14px",
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                }}
              >
                <CheckCircle2
                  size={18}
                  style={{
                    color: "var(--color-brand)",
                    marginTop: 1,
                    flexShrink: 0,
                  }}
                  aria-hidden
                />
                <span
                  style={{
                    fontSize: "var(--fs-body-sm)",
                    color: "var(--color-text)",
                  }}
                >
                  {t(p)}
                </span>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={120} style={ctaCard}>
          <DotPattern color="rgba(255,255,255,.12)" fade="right" />
          <div
            style={{
              position: "relative",
              display: "grid",
              gap: "var(--s-3)",
              maxWidth: "62%",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontSize: "var(--fs-h3)",
                lineHeight: 1.15,
              }}
            >
              {t("ctaTitle")}
            </h3>
            <p
              style={{
                margin: 0,
                color: "rgba(255,255,255,.85)",
                fontSize: "var(--fs-body-sm)",
              }}
            >
              {t("ctaBody")}
            </p>
            <div>
              <Link
                href="/tourism/request-consultation"
                style={solidBtn(ORANGE)}
              >
                {hub("startCase")}
                <ArrowRight size={16} aria-hidden />
              </Link>
            </div>
            <span
              style={{
                color: "rgba(255,255,255,.7)",
                fontSize: "var(--fs-caption)",
              }}
            >
              {t("ctaTagline")}
            </span>
          </div>
          <div
            aria-hidden
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              top: 0,
              width: "42%",
              borderTopRightRadius: "var(--r-xl)",
              borderBottomRightRadius: "var(--r-xl)",
              overflow: "hidden",
            }}
          >
            <Image
              src="/smiling-medical-team-portrait.jpeg"
              alt=""
              fill
              sizes="320px"
              style={{ objectFit: "cover", objectPosition: "center 20%" }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(90deg, var(--teal-600) 0%, rgba(9,115,119,0) 55%)",
              }}
            />
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}

/* ----------------------------------------------------------- shared styles */
const cardBox: CSSProperties = {
  height: "100%",
  display: "flex",
  flexDirection: "column",
  gap: "var(--s-3)",
  padding: "var(--s-5)",
  borderRadius: "var(--r-lg)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  boxShadow: "var(--shadow-xs)",
  textDecoration: "none",
};
const iconChip: CSSProperties = {
  display: "inline-flex",
  width: 48,
  height: 48,
  borderRadius: "var(--r-md)",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--color-brand-soft)",
  color: "var(--color-brand-deep)",
};
const supportChip: CSSProperties = {
  display: "inline-flex",
  width: 52,
  height: 52,
  borderRadius: "var(--r-pill)",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  color: "var(--color-brand-deep)",
  boxShadow: "var(--shadow-xs)",
};
const ctaCard: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  borderRadius: "var(--r-xl)",
  padding: "var(--s-8)",
  minHeight: 220,
  background: "linear-gradient(150deg, var(--teal-700), var(--teal-500))",
  color: "#fff",
  display: "flex",
  alignItems: "center",
};
const learnMore: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  color: "var(--color-brand-deep)",
  fontSize: "var(--fs-body-sm)",
  fontWeight: 600,
  textDecoration: "none",
};
function solidBtn(bg: string): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    height: 46,
    padding: "0 22px",
    borderRadius: "var(--r-pill)",
    background: bg,
    color: "#fff",
    fontWeight: 600,
    fontSize: 15,
    textDecoration: "none",
    boxShadow: "var(--shadow-md)",
  };
}
