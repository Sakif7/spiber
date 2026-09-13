import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Download } from "lucide-react";
import { ApplicationStatusSelect } from "@/components/admin/career/application-status";
import { getApplicationByIdLean } from "@/lib/repositories/career.repo";
import { Button } from "@/components/ui/button";
import { EditorHeader } from "@/components/admin/ui/form-shell";
import {
  DetailCard,
  DetailLayout,
  DetailProse,
  DetailRow,
} from "@/components/admin/ui/detail";

export const dynamic = "force-dynamic";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const app = await getApplicationByIdLean(id).catch(() => null);
  if (!app) notFound();

  return (
    <div className="space-y-4">
      <EditorHeader
        backHref="/admin/career/applications"
        backLabel="All applications"
        title={app.name}
        action={
          <ApplicationStatusSelect id={String(app._id)} status={app.status} />
        }
      />

      <DetailLayout className="max-w-3xl">
        <DetailCard>
          <DetailRow label="Position">{app.jobTitle ?? "—"}</DetailRow>
          <DetailRow label="Email">
            <a
              href={`mailto:${app.email}`}
              className="text-primary hover:underline"
            >
              {app.email}
            </a>
          </DetailRow>
          <DetailRow label="Phone">
            <a
              href={`tel:${app.phone}`}
              className="text-primary hover:underline"
            >
              {app.phone}
            </a>
          </DetailRow>
          <DetailRow label="Applied">
            {new Date(app.createdAt).toLocaleString()}
          </DetailRow>
          <DetailRow label="Reference" mono>
            {app.applicationNumber}
          </DetailRow>
          <div className="pt-1">
            <Button asChild size="sm">
              <a
                href={`/api/admin/career/applications/${String(app._id)}/resume`}
              >
                <Download className="size-4" />
                Download résumé{app.resumeName ? ` (${app.resumeName})` : ""}
              </a>
            </Button>
          </div>
        </DetailCard>

        {app.coverLetter && (
          <DetailCard title="Cover letter">
            <DetailProse className="leading-relaxed">
              {app.coverLetter}
            </DetailProse>
          </DetailCard>
        )}
      </DetailLayout>
    </div>
  );
}
