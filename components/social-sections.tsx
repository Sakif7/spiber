"use client";

import { useEffect, useState } from "react";
import {
  Arrow,
  Container,
  Placeholder,
  Reveal,
  Section,
  SectionTitle,
} from "./primitives";

/* ============================================================
   TESTIMONIALS — server-hydrated carousel
   ============================================================ */
type Testimonial = {
  quote: string;
  name: string;
  role: string;
  tone: "teal" | "orange" | "slate";
};

const FALLBACK_TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "I have had the pleasure of working with SPIBER MED for all our medical equipment needs, and I can confidently say they are one of the best in the industry. Their commitment to quality, reliability, and customer satisfaction is unmatched. In a field where precision and dependability are non-negotiable, they consistently go above and beyond.",
    name: "Prof. Dr. Md. Moazzem Hossain",
    role: "Chairman · Aichi Healthcare Group",
    tone: "teal",
  },
  {
    quote:
      "A remarkable partner that has earned my confidence in just a few months. Their proactive approach to addressing our needs has been impressive — they understood our requirements from the outset and consistently exceeded expectations.",
    name: "Arpit Ahuja",
    role: "Founder & Director · TOP MRI & Medicto",
    tone: "orange",
  },
  {
    quote:
      "End-to-end delivery on a scale I haven't seen elsewhere in the region. From feasibility study through commissioning and training, the team kept us on schedule and on budget.",
    name: "Dr. Sumaiya Khan",
    role: "Director · Greenlife Specialty Hospital",
    tone: "slate",
  },
];

export function Testimonials({ initial }: { initial?: Testimonial[] }) {
  const [items, setItems] = useState<Testimonial[]>(
    initial && initial.length ? initial : FALLBACK_TESTIMONIALS
  );
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (initial && initial.length) return;
    let cancelled = false;
    fetch("/api/testimonials")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { testimonials?: Testimonial[] }) => {
        if (cancelled) return;
        if (data.testimonials && data.testimonials.length) setItems(data.testimonials);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initial]);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 7000);
    return () => clearInterval(t);
  }, [paused, items.length]);

  const cur = items[idx];

  return (
    <Section style={{ background: "var(--color-surface-2)" }}>
      <Container>
        <div
          className="equal-2col"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.4fr",
            gap: 64,
            alignItems: "center",
          }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <SectionTitle
            eyebrow="TESTIMONIAL"
            title="What people say about SPIBER MED."
            lede="A few of the people we work with — chairs of hospital groups, founders of imaging centers, hospital administrators."
          />

          <div style={{ position: "relative" }}>
            <div
              key={idx}
              style={{
                position: "relative",
                minHeight: 380,
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--r-2xl)",
                padding: "44px 48px 32px",
                boxShadow: "var(--shadow-md)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                animation: "tFade 600ms cubic-bezier(.16,1,.3,1)",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 18,
                  right: 32,
                  fontSize: 120,
                  lineHeight: 0.8,
                  color: "var(--teal-100)",
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                }}
              >
                &ldquo;
              </span>

              <div style={{ position: "relative" }}>
                <p
                  style={{
                    margin: "0 0 28px",
                    fontFamily: "var(--font-display)",
                    fontWeight: 500,
                    fontSize: 22,
                    lineHeight: 1.4,
                    letterSpacing: "-.005em",
                    color: "var(--color-text-strong)",
                    maxWidth: "60ch",
                  }}
                >
                  {cur.quote}
                </p>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: 20,
                    borderTop: "1px solid var(--color-hairline)",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <Placeholder
                      label=""
                      tone={cur.tone}
                      style={{ width: 52, height: 52, borderRadius: 999, overflow: "hidden" }}
                    />
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 15,
                          color: "var(--color-text-strong)",
                        }}
                      >
                        {cur.name}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--color-text-muted)",
                          marginTop: 2,
                        }}
                      >
                        {cur.role}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={() => setIdx((i) => (i - 1 + items.length) % items.length)}
                      style={navBtn(false)}
                      aria-label="Previous testimonial"
                    >
                      <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}>
                        <Arrow size={14} />
                      </span>
                    </button>
                    <button
                      onClick={() => setIdx((i) => (i + 1) % items.length)}
                      style={navBtn(true)}
                      aria-label="Next testimonial"
                    >
                      <Arrow size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "center" }}
            >
              {items.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  aria-label={`Go to testimonial ${i + 1}`}
                  style={{
                    width: i === idx ? 26 : 6,
                    height: 6,
                    borderRadius: 999,
                    background: i === idx ? "var(--color-brand)" : "var(--slate-300)",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    transition: "all 300ms cubic-bezier(.16,1,.3,1)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}

function navBtn(filled: boolean): React.CSSProperties {
  return {
    width: 40,
    height: 40,
    borderRadius: 999,
    background: filled ? "var(--color-brand)" : "var(--color-surface)",
    color: filled ? "white" : "var(--color-text)",
    border: filled ? "none" : "1px solid var(--color-border)",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: filled ? "var(--shadow-brand)" : "none",
    transition: "all 240ms cubic-bezier(.16,1,.3,1)",
  };
}

/* ============================================================
   MANAGEMENT BODY
   ============================================================ */
type TeamMember = {
  name: string;
  role: string;
  placeholder: string;
  tone: "teal" | "orange" | "slate";
};

export function Management() {
  const team: TeamMember[] = [
    { name: "Dr. Md Jahidul Islam", role: "MD & CEO", placeholder: "CEO portrait", tone: "teal" },
    { name: "Md. Aktaruzzaman Sarker", role: "Director", placeholder: "Director portrait", tone: "slate" },
    { name: "Mostary Morshed Smriti", role: "Director · COO", placeholder: "COO portrait", tone: "orange" },
    { name: "Md. Showkot Ali", role: "Director", placeholder: "Director portrait", tone: "teal" },
    { name: "Sheikh Moha. Faizullah Shipon", role: "Director · CMO", placeholder: "CMO portrait", tone: "slate" },
  ];

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
            eyebrow="MANAGEMENT BODY"
            title="Meet the people leading SPIBER MED."
            lede="A team of clinicians, operators, and builders — combined decades of work across hospital systems, manufacturing, and medical education."
          />
          <Reveal delay={200} style={{ alignSelf: "end" }}>
            <a
              href="#"
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
              See full leadership <Arrow />
            </a>
          </Reveal>
        </div>

        <div
          className="equal-5col"
          style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}
        >
          {team.map((p, i) => (
            <Reveal key={p.name} delay={i * 80}>
              <TeamCard {...p} />
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

function TeamCard({ name, role, placeholder, tone }: TeamMember) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "var(--color-surface)",
        height: "100%",
        border: "1px solid " + (hover ? "var(--teal-200)" : "var(--color-border)"),
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transform: hover ? "translateY(-3px)" : "translateY(0)",
        boxShadow: hover ? "var(--shadow-md)" : "var(--shadow-xs)",
        transition: "all 300ms cubic-bezier(.16,1,.3,1)",
        cursor: "pointer",
      }}
    >
      <div style={{ height: 240, overflow: "hidden", position: "relative" }}>
        <Placeholder
          label={placeholder}
          tone={tone}
          style={{
            width: "100%",
            height: "100%",
            transform: hover ? "scale(1.04)" : "scale(1)",
            transition: "transform 600ms cubic-bezier(.16,1,.3,1)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, transparent 50%, rgba(10,19,24,.55))",
            opacity: hover ? 1 : 0.6,
            transition: "opacity 240ms",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 16,
            display: "flex",
            gap: 8,
            opacity: hover ? 1 : 0,
            transform: hover ? "translateY(0)" : "translateY(6px)",
            transition: "all 280ms cubic-bezier(.16,1,.3,1)",
          }}
        >
          {["in", "X", "fb"].map((s) => (
            <span
              key={s}
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "rgba(255,255,255,.92)",
                backdropFilter: "blur(8px)",
                display: "grid",
                placeItems: "center",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 600,
                color: "var(--color-text-strong)",
              }}
            >
              {s}
            </span>
          ))}
        </div>
      </div>
      <div style={{ padding: 18 }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 15,
            letterSpacing: "-.005em",
            color: "var(--color-text-strong)",
            lineHeight: 1.25,
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--color-brand-deep)",
            fontWeight: 500,
            marginTop: 4,
          }}
        >
          {role}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   LATEST NEWS — server-hydrated cards
   ============================================================ */
type Post = {
  kicker: string;
  title: string;
  excerpt: string;
  date: string;
  read: string;
  tone: "teal" | "orange" | "slate";
  placeholder: string;
};

const FALLBACK_POSTS: Post[] = [
  {
    kicker: "INDUSTRY",
    title: "Healthcare industry management — the operator's lens",
    excerpt:
      "A long-form look at how Bangladesh's hospital operators are modernizing — and the structural reforms that need to follow.",
    date: "25 NOV 2025",
    read: "8 min",
    tone: "teal",
    placeholder: "industry feature photo",
  },
  {
    kicker: "WORKFORCE",
    title: "Global employability for healthcare professionals",
    excerpt:
      "How our overseas placement pathways are connecting Bangladeshi clinicians with hospitals in Japan, Germany, and the UK.",
    date: "18 NOV 2025",
    read: "6 min",
    tone: "orange",
    placeholder: "workforce photo",
  },
  {
    kicker: "FIELD NOTES",
    title: "Lessons from the COVID-19 response, five years on",
    excerpt:
      "What worked, what didn't, and what every hospital can carry forward into the next public-health emergency.",
    date: "01 NOV 2025",
    read: "10 min",
    tone: "slate",
    placeholder: "field photo",
  },
];

export function LatestNews({ initial }: { initial?: Post[] }) {
  const [posts, setPosts] = useState<Post[]>(
    initial && initial.length ? initial : FALLBACK_POSTS
  );

  useEffect(() => {
    if (initial && initial.length) return;
    let cancelled = false;
    fetch("/api/news")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { posts?: Post[] }) => {
        if (cancelled) return;
        if (data.posts && data.posts.length) setPosts(data.posts);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initial]);

  return (
    <Section style={{ background: "var(--color-surface-2)" }}>
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
            eyebrow="LATEST NEWS"
            title="Field notes from the front of healthcare."
            lede="Stories, analysis, and dispatches from our team and partners."
          />
          <Reveal delay={200} style={{ alignSelf: "end" }}>
            <a
              href="#"
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
              Visit the blog <Arrow />
            </a>
          </Reveal>
        </div>

        <div
          className="equal-3col"
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}
        >
          {posts.map((p, i) => (
            <Reveal key={p.title} delay={i * 100}>
              <NewsCard {...p} />
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

function NewsCard({ kicker, title, excerpt, date, read, tone, placeholder }: Post) {
  const [hover, setHover] = useState(false);
  return (
    <article
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "var(--color-surface)",
        height: "100%",
        border: "1px solid " + (hover ? "var(--teal-200)" : "var(--color-border)"),
        borderRadius: "var(--r-xl)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transform: hover ? "translateY(-3px)" : "translateY(0)",
        boxShadow: hover ? "var(--shadow-md)" : "var(--shadow-xs)",
        transition: "all 280ms cubic-bezier(.16,1,.3,1)",
        cursor: "pointer",
      }}
    >
      <div style={{ height: 200, overflow: "hidden", position: "relative" }}>
        <Placeholder
          label={placeholder}
          tone={tone}
          style={{
            width: "100%",
            height: "100%",
            transform: hover ? "scale(1.06)" : "scale(1)",
            transition: "transform 700ms cubic-bezier(.16,1,.3,1)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: ".14em",
            color: "var(--color-text-strong)",
            background: "rgba(255,255,255,.92)",
            backdropFilter: "blur(8px)",
            padding: "5px 9px",
            borderRadius: 4,
          }}
        >
          {kicker}
        </div>
      </div>
      <div
        style={{
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          flex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 14,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--color-text-muted)",
            letterSpacing: ".06em",
          }}
        >
          <span>{date}</span>
          <span>·</span>
          <span>{read} read</span>
        </div>
        <h3
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 20,
            lineHeight: 1.25,
            letterSpacing: "-.015em",
            color: "var(--color-text-strong)",
          }}
        >
          {title}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.6,
            color: "var(--color-text-muted)",
            flex: 1,
          }}
        >
          {excerpt}
        </p>
        <div
          style={{
            marginTop: 4,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 500,
            color: "var(--color-brand-deep)",
            transform: hover ? "translateX(2px)" : "translateX(0)",
            transition: "transform 280ms cubic-bezier(.16,1,.3,1)",
          }}
        >
          Read more <Arrow size={12} />
        </div>
      </div>
    </article>
  );
}

export type { Testimonial, Post };
