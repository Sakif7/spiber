import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import {
  JobForm,
  type JobFormInitial,
} from "@/components/admin/career/job-form";
import { getJobByIdLean } from "@/lib/repositories/career.repo";

export const dynamic = "force-dynamic";

const L = (v?: { en?: string; bn?: string }) => ({
  en: v?.en ?? "",
  bn: v?.bn ?? "",
});

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const job = await getJobByIdLean(id).catch(() => null);
  if (!job) notFound();

  const initial: JobFormInitial = {
    id: String(job._id),
    title: L(job.title),
    slug: job.slug,
    department: L(job.department),
    reportsTo: L(job.reportsTo),
    location: L(job.location),
    employmentType: job.employmentType,
    experience: L(job.experience),
    vacancies: job.vacancies != null ? String(job.vacancies) : "",
    summary: L(job.summary),
    description: L(job.description),
    responsibilities: L(job.responsibilities),
    requirements: L(job.requirements),
    preferredSkills: L(job.preferredSkills),
    benefits: L(job.benefits),
    applyEmail: job.applyEmail ?? "",
    recruiterName: job.recruiterName ?? "",
    recruiterTitle: L(job.recruiterTitle),
    recruiterEmail: job.recruiterEmail ?? "",
    recruiterPhone: job.recruiterPhone ?? "",
    closesAt: job.closesAt
      ? new Date(job.closesAt).toISOString().slice(0, 10)
      : "",
    status: job.status,
  };

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
        Edit job
      </h1>
      <JobForm initial={initial} />
    </div>
  );
}
