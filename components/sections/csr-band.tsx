"use client";

import {
  Container,
  Reveal,
  Section,
  SectionTitle,
} from "@/components/ui";

const PILLARS = [
  {
    icon: "M12 21s-7-4.5-7-11a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 6.5-7 11-7 11Z",
    title: "Devoted to communities",
    body: "Useful products and solutions delivered to communities that need them most.",
  },
  {
    icon: "M4 12a8 8 0 0 1 16 0M4 12h16M4 12a8 8 0 0 0 16 0",
    title: "Promoting public health",
    body: "Vigorous support for programs that broaden access to healthcare.",
  },
  {
    icon: "M3 13l4-4 4 4 4-6 4 6",
    title: "Dispersing technology",
    body: "Continued innovation that brings advanced tech to every corner of the country.",
  },
  {
    icon: "M5 19v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2 M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    title: "Fostering medical talents",
    body: "A knowledge-sharing platform that helps clinicians grow and connect.",
  },
];

export function CSRBand() {
  return (
    <Section dark mesh>
      <Container>
        <div
          className="equal-2col"
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 1fr",
            gap: 64,
            alignItems: "center",
            marginBottom: 56,
          }}
        >
          <SectionTitle
            dark
            eyebrow="CORPORATE SOCIAL RESPONSIBILITY"
            title="Accessible healthcare at every corner of Bangladesh."
            lede="SPIBER aspires to enhance healthcare for all. Our work to be an outstanding corporate citizen grows alongside our philosophy."
          />
          <Reveal delay={200}>
            <blockquote
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontSize: 22,
                lineHeight: 1.45,
                color: "rgba(255,255,255,.88)",
                letterSpacing: "-.005em",
                borderLeft: "2px solid var(--orange-400)",
                paddingLeft: 24,
                fontStyle: "italic",
                fontWeight: 400,
              }}
            >
              &ldquo;We endeavor to be an outstanding corporate citizen — growing every year with the same philosophy that started us.&rdquo;
              <footer
                style={{
                  marginTop: 14,
                  fontStyle: "normal",
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  color: "rgba(255,255,255,.55)",
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                }}
              >
                — FROM OUR CORPORATE PHILOSOPHY
              </footer>
            </blockquote>
          </Reveal>
        </div>

        <div
          className="equal-4col"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 18,
          }}
        >
          {PILLARS.map((p, i) => (
            <Reveal key={p.title} delay={i * 80}>
              <div
                style={{
                  padding: 24,
                  height: "100%",
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid rgba(255,255,255,.1)",
                  backdropFilter: "blur(8px)",
                  borderRadius: "var(--r-lg)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                  minHeight: 240,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "rgba(20,179,152,.18)",
                    color: "var(--teal-300)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d={p.icon}
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-display)",
                    fontWeight: 600,
                    fontSize: 18,
                    letterSpacing: "-.01em",
                    lineHeight: 1.25,
                    color: "white",
                  }}
                >
                  {p.title}
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: "rgba(255,255,255,.7)",
                    flex: 1,
                  }}
                >
                  {p.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
