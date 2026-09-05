import { setRequestLocale } from "next-intl/server";
import { CourseBuilder } from "@/components/admin/academy/course-builder";
import { EditorHeader } from "@/components/admin/ui/form-shell";

export const dynamic = "force-dynamic";

export default async function NewCoursePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="space-y-4">
      <EditorHeader
        backHref="/admin/courses"
        backLabel="Courses"
        title="New course"
      />
      <CourseBuilder />
    </div>
  );
}
