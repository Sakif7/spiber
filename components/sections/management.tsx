"use client";

import { ReactNode, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { Link } from "@/i18n/navigation";
import {
  Arrow,
  Container,
  Reveal,
  Section,
  SectionTitle,
} from "@/components/ui";

type Social = { label: string; href: string; icon: ReactNode };

type TeamMember = {
  name: string;
  role: string;
  image: string;
  bio: string;
  socials: Social[];
};

const LinkedInIcon = (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="currentColor"
    aria-hidden
  >
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14zM8.339 18.337V10.27H5.667v8.067h2.672zM7.003 9.16a1.55 1.55 0 1 0 0-3.1 1.55 1.55 0 0 0 0 3.1zm11.336 9.177v-4.418c0-2.397-1.279-3.516-2.985-3.516-1.376 0-1.992.756-2.336 1.286V10.27H10.346c.035.754 0 8.067 0 8.067h2.672v-4.503c0-.24.017-.48.088-.652.193-.48.633-.978 1.374-.978.969 0 1.358.738 1.358 1.823v4.31h2.673z" />
  </svg>
);

const EmailIcon = (
  <svg
    viewBox="0 0 24 24"
    width="13"
    height="13"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    aria-hidden
  >
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);

const TEAM: Omit<TeamMember, "role" | "bio" | "socials">[] = [
  {
    name: "Morsheda Parvin Misti",
    image: "/mishti-managing-body.jpeg",
  },
  {
    name: "Dr. Md Jahidul Islam",
    image: "/jahidul-managing-body.png",
  },
  {
    name: "Mostary Morshed Smriti",
    image: "/smriti-managing-body.png",
  },
  {
    name: "Subrina Azmi Kanta",
    image: "/kanta-managing-body.jpeg",
  },
  // Hidden per request. To re-enable, uncomment this entry AND restore the
  // matching object (index 4, "Chief Advisor") in `home.management.members`
  // of messages/en.json and messages/bn.json so the parallel arrays realign.
  // {
  //   name: "Prof. Dr. Md. Moazzem Hossain",
  //   image: "/moazzem-testimonial.jpg",
  // },
  {
    name: "Md Saadman Sakif",
    image: "/sakif-managing-body.jpeg",
  },
];

const SOCIAL_ICONS: ReactNode[] = [LinkedInIcon, EmailIcon];

export function Management() {
  const t = useTranslations("home.management");
  const reduced = useReducedMotion();

  const members = t.raw("members") as Array<{
    role: string;
    bio: string;
    socials: { label: string }[];
  }>;

  const team: TeamMember[] = TEAM.map((m, i) => ({
    ...m,
    role: members[i].role,
    bio: members[i].bio,
    socials: members[i].socials.map((s, j) => ({
      label: s.label,
      href: "/company/about",
      icon: SOCIAL_ICONS[j],
    })),
  }));

  return (
    <Section>
      <Container>
        <div
          className="equal-2col"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 64,
            alignItems: "end",
            marginBottom: 48,
          }}
        >
          <SectionTitle
            eyebrow={t("eyebrow")}
            title={t("title")}
            lede={t("lede")}
          />
          <Reveal delay={200} style={{ alignSelf: "end" }}>
            <Link
              href="/company/about"
              style={{
                alignSelf: "end",
                justifySelf: "end",
                fontSize: 14,
                fontWeight: 500,
                color: "var(--color-brand-deep)",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
              }}
            >
              {t("seeFullLeadership")} <Arrow />
            </Link>
          </Reveal>
        </div>

        <Reveal>
          <Marquee team={team} reduced={!!reduced} />
        </Reveal>
      </Container>
    </Section>
  );
}

const CARD_W = 268;
const CARD_GAP = 16;
const SPEED = 42; // px / second

const EDGE_FADE =
  "linear-gradient(90deg, transparent 0, #000 7%, #000 93%, transparent 100%)";

/**
 * Auto-scrolling marquee of leadership cards. The track is duplicated so the
 * loop is seamless; an rAF loop (framer's `useAnimationFrame`) advances the
 * track and wraps at one-copy width. Pauses while hovered so cards can be read.
 * Reduced motion → a static, manually scrollable rail.
 */
function Marquee({ team, reduced }: { team: TeamMember[]; reduced: boolean }) {
  const x = useMotionValue(0);
  const [paused, setPaused] = useState(false);

  // Two copies for a seamless loop (single copy when motion is reduced).
  const items = reduced ? team : [...team, ...team];

  // Width of one copy = sum of every card's box (width + trailing gap).
  const copyWidth = (CARD_W + CARD_GAP) * team.length;

  useAnimationFrame((_, delta) => {
    if (reduced || paused || copyWidth <= 0) return;
    let next = x.get() - (SPEED * delta) / 1000;
    if (next <= -copyWidth) next += copyWidth; // wrap seamlessly
    x.set(next);
  });

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        position: "relative",
        width: "100%",
        overflowX: reduced ? "auto" : "hidden",
        overflowY: "hidden",
        // breathing room so the hover lift/shadow isn't clipped
        paddingBlock: 28,
        WebkitMaskImage: EDGE_FADE,
        maskImage: EDGE_FADE,
      }}
    >
      <motion.div
        style={{
          display: "flex",
          width: "max-content",
          perspective: 1400,
          x: reduced ? 0 : x,
        }}
      >
        {items.map((p, i) => (
          <div
            key={`${p.name}-${i}`}
            aria-hidden={!reduced && i >= team.length}
            style={{ flex: `0 0 ${CARD_W}px`, marginRight: CARD_GAP }}
          >
            <TeamCard member={p} />
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function TeamCard({ member }: { member: TeamMember }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const springCfg = { stiffness: 260, damping: 22, mass: 0.6 };
  const rotateY = useSpring(
    useTransform(mx, [-0.5, 0.5], [-10, 10]),
    springCfg,
  );
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [9, -9]), springCfg);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const handleMouseLeave = () => {
    setIsHovered(false);
    mx.set(0);
    my.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        position: "relative",
        cursor: "pointer",
        zIndex: isHovered ? 10 : 1,
        transformStyle: "preserve-3d",
        rotateX,
        rotateY,
      }}
    >
      <motion.div
        animate={
          isHovered
            ? {
                y: -10,
                scale: 1.06,
                boxShadow:
                  "0 1px 2px rgba(10,31,44,.05), 0 30px 60px -20px color-mix(in srgb, var(--brand-teal) 40%, transparent), 0 0 0 1px color-mix(in srgb, var(--brand-teal) 12%, transparent)",
              }
            : {
                y: 0,
                scale: 1,
                boxShadow:
                  "0 1px 2px rgba(10,31,44,.04), 0 0 0 1px rgba(10,31,44,.05)",
              }
        }
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
        style={{
          background: "var(--color-surface)",
          border:
            "1px solid " + (isHovered ? "var(--teal-300)" : "var(--teal-100)"),
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
          position: "relative",
          transformStyle: "preserve-3d",
        }}
      >
        <div
          style={{
            position: "relative",
            height: 280,
            overflow: "hidden",
          }}
        >
          <motion.div
            animate={{ scale: isHovered ? 1.06 : 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            style={{ position: "absolute", inset: 0 }}
          >
            <Image
              src={member.image}
              alt={`${member.name} — ${member.role}`}
              fill
              sizes="(max-width: 980px) 50vw, 260px"
              style={{ objectFit: "cover", objectPosition: "center top" }}
            />
          </motion.div>

          <motion.div
            aria-hidden
            animate={{ opacity: isHovered ? 1 : 0.55 }}
            transition={{ duration: 0.3 }}
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, transparent 35%, rgba(10,19,24,.42) 70%, rgba(10,19,24,.85) 100%)",
            }}
          />

          <motion.div
            initial={false}
            animate={{ y: isHovered ? 0 : "100%" }}
            transition={{ type: "spring", stiffness: 220, damping: 28 }}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: "18px 18px 18px",
              background:
                "linear-gradient(0deg, rgba(10,19,24,.96) 0%, rgba(10,19,24,.92) 55%, rgba(10,19,24,.78) 100%)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              color: "white",
              borderTop: "1px solid rgba(255,255,255,.08)",
            }}
          >
            <motion.p
              animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 6 }}
              transition={{ duration: 0.35, delay: isHovered ? 0.08 : 0 }}
              style={{
                margin: 0,
                fontSize: 12.5,
                lineHeight: 1.5,
                color: "rgba(255,255,255,.88)",
              }}
            >
              {member.bio}
            </motion.p>

            <motion.div
              animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 8 }}
              transition={{ duration: 0.35, delay: isHovered ? 0.16 : 0 }}
              style={{
                display: "flex",
                gap: 8,
                marginTop: 12,
              }}
            >
              {member.socials.map((s) => (
                <SocialChip key={s.label} {...s} />
              ))}
            </motion.div>
          </motion.div>
        </div>

        <div style={{ padding: "16px 14px" }}>
          <div
            title={member.name}
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: 13,
              letterSpacing: "-.012em",
              color: "var(--color-text-strong)",
              lineHeight: 1.25,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {member.name}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: "var(--color-brand-deep)",
              fontWeight: 500,
              marginTop: 4,
            }}
          >
            {member.role}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SocialChip({ label, href, icon }: Social) {
  return (
    <Link
      href={href}
      aria-label={label}
      style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        background: "rgba(255,255,255,.10)",
        border: "1px solid rgba(255,255,255,.16)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        transition:
          "background 180ms, color 180ms, transform 200ms cubic-bezier(.16,1,.3,1)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--brand-teal)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,.10)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {icon}
    </Link>
  );
}
