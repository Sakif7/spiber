import { setRequestLocale } from "next-intl/server";
import { TestimonialForm } from "@/components/admin/testimonial-form";
import { EditorHeader } from "@/components/admin/ui/form-shell";

export const dynamic = "force-dynamic";

export default async function NewTestimonialPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="space-y-4">
      <EditorHeader
        backHref="/admin/testimonials"
        backLabel="Testimonials"
        title="New testimonial"
      />
      <TestimonialForm />
    </div>
  );
}
