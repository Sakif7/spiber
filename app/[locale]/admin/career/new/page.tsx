import { setRequestLocale } from "next-intl/server";
import { JobForm } from "@/components/admin/career/job-form";
import { EditorHeader } from "@/components/admin/ui/form-shell";

export const dynamic = "force-dynamic";

export default async function NewJobPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="space-y-4">
      <EditorHeader
        backHref="/admin/career"
        backLabel="Career"
        title="New job"
      />
      <JobForm />
    </div>
  );
}
