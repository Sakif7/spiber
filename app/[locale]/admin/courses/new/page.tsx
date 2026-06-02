import { setRequestLocale } from "next-intl/server";
import { CourseBuilder } from "@/components/admin/academy/course-builder";

export const dynamic = "force-dynamic";

export default async function NewCoursePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--s-6)" }}
    >
      <h1
        style={{
          margin: 0,
          fontFamily: "var(--font-display)",
          fontSize: "var(--fs-2xl)",
          color: "var(--color-text-strong)",
        }}
      >
        New course
      </h1>
      <CourseBuilder />
    </div>
  );
}
