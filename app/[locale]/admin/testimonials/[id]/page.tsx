import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTestimonialById } from "@/lib/repositories/testimonials.repo";
import { TestimonialForm } from "@/components/admin/testimonial-form";
import { EditorHeader } from "@/components/admin/ui/form-shell";

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
    <div className="space-y-4">
      <EditorHeader
        backHref="/admin/testimonials"
        backLabel="Testimonials"
        title="Edit testimonial"
      />
      <TestimonialForm id={id} initial={initial} />
    </div>
  );
}
