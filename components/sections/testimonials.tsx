"use client";

import { Container, Eyebrow, Reveal, Section } from "@/components/ui";
import {
  AnimatedTestimonials,
  type AnimatedTestimonial,
} from "@/components/ui/animated-testimonials";

const TESTIMONIALS: AnimatedTestimonial[] = [
  {
    quote:
      "I have had the pleasure of working with SPIBER Healthcare Ltd. for all our medical equipment needs, and I can confidently say they are one of the best in the industry. Their commitment to quality, reliability, and customer satisfaction is unmatched. From the moment we reached out, their team demonstrated exceptional professionalism, offering expert advice tailored to our specific requirements. The equipment we received was of the highest standard, delivered promptly, and supported by comprehensive training and after-sales service. In a field where precision and dependability are non-negotiable, SPIBER Healthcare Ltd. consistently goes above and beyond to ensure we have the tools we need to provide top-tier care.",
    name: "Prof. Dr. Md. Moazzem Hossain",
    designation: "Chairman · Aichi Healthcare Group",
    src: "/moazzem-testimonial.jpg",
  },
  {
    quote:
      "I am delighted to share my positive experience with SPIBER Healthcare Ltd., a remarkable partner that has truly earned my confidence in just a few months of our collaboration. Their proactive approach to addressing our needs has been nothing short of impressive. From the outset, the company demonstrated a keen understanding of our requirements, swiftly adapting and providing solutions that exceeded our expectations.",
    name: "Arpit Ahuja",
    designation: "Founder & Director · TOP MRI & Medicto",
    src: "/ahuja-testimonial.png",
  },
];

export function Testimonials() {
  return (
    <Section dots style={{ background: "var(--color-surface-2)" }}>
      <Container>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            marginBottom: 56,
            textAlign: "center",
          }}
        >
          <Reveal>
            <Eyebrow>TESTIMONIAL</Eyebrow>
          </Reveal>
          <Reveal delay={80}>
            <h2
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontWeight: 500,
                fontSize: "clamp(34px, 4.2vw, 56px)",
                lineHeight: 1.05,
                letterSpacing: "-.022em",
                color: "var(--color-text-strong)",
                maxWidth: "18ch",
              }}
            >
              In the words of the people we work with.
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <p
              style={{
                margin: 0,
                fontSize: 16,
                lineHeight: 1.6,
                color: "var(--color-text-muted)",
                maxWidth: "56ch",
              }}
            >
              Hospital chairs, founders of imaging centres, and clinical
              directors on what it&apos;s like to partner with SPIBER MED.
            </p>
          </Reveal>
        </div>

        <Reveal delay={120}>
          <AnimatedTestimonials testimonials={TESTIMONIALS} autoplay />
        </Reveal>
      </Container>
    </Section>
  );
}
