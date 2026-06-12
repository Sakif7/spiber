import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getTestimonialById } from "@/lib/repositories/testimonials.repo";
import { TestimonialForm } from "@/components/admin/testimonial-form";

export const dynamic = "force-dynamic";

export default async function EditTestimonialPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const doc = await getTestimonialById(id);
  if (!doc) notFound();

  const initial = {
    quote: doc.quote,
    name: doc.name,
    role: doc.role ?? "",
    imageSrc: doc.imageSrc ?? "",
    tone: doc.tone ?? "teal",
    category: doc.category ?? "general",
    order: doc.order ?? 0,
    published: doc.published !== false,
  };

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <div style={{ display: "grid", gap: "var(--s-2)" }}>
        <Link
          href="/admin/testimonials"
          style={{
            fontSize: "var(--fs-small)",
            color: "var(--color-text-muted)",
          }}
        >
          ← Testimonials
        </Link>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-2xl)",
            color: "var(--color-text-strong)",
          }}
        >
          Edit testimonial
        </h1>
      </div>
      <TestimonialForm id={id} initial={initial} />
    </div>
  );
}
