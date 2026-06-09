import { setRequestLocale } from "next-intl/server";
import { JobForm } from "@/components/admin/career/job-form";

export const dynamic = "force-dynamic";

export default async function NewJobPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <h1
        style={{
          margin: 0,
          fontFamily: "var(--font-display)",
          fontSize: "var(--fs-2xl)",
          color: "var(--color-text-strong)",
        }}
      >
        New job
      </h1>
      <JobForm />
    </div>
  );
}
