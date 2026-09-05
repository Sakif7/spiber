import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { CaseActions } from "@/components/admin/case-actions";
import { CaseDocumentViewer } from "@/components/admin/case-document-viewer";
import { CaseChecklist } from "@/components/admin/case-checklist";
import { getMedicalCaseByIdLean } from "@/lib/repositories/medicalCases.repo";
import { getHospitalByIdLean } from "@/lib/repositories/hospitals.repo";
import { getDoctorByIdLean } from "@/lib/repositories/doctors.repo";
import { getPackageByIdLean } from "@/lib/repositories/packages.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { localize } from "@/lib/schemas/localized";
import { formatBDT } from "@/lib/money";
import { asLocale } from "@/lib/i18n/intl-locale";
import { EditorHeader } from "@/components/admin/ui/form-shell";
import {
  DetailCard,
  DetailLayout,
  DetailProse,
  DetailRow,
} from "@/components/admin/ui/detail";
import { StatusBadge } from "@/components/admin/ui/status-badge";

export const dynamic = "force-dynamic";

export default async function AdminCaseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const l = asLocale(locale);

  const c = await getMedicalCaseByIdLean(id).catch(() => null);
  if (!c) notFound();
  const user = await getSessionUser();
  const assignedToMe = Boolean(
    user && c.assignedTo && String(c.assignedTo) === user.sub,
  );

  const [hospital, doctor, pkg] = await Promise.all([
    c.hospitalId ? getHospitalByIdLean(String(c.hospitalId)) : null,
    c.doctorId ? getDoctorByIdLean(String(c.doctorId)) : null,
    c.packageId ? getPackageByIdLean(String(c.packageId)) : null,
  ]);

  return (
    <div className="space-y-4">
      <EditorHeader
        backHref="/admin/tourism/cases"
        backLabel="Cases"
        title={c.caseNumber}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge>{c.status}</StatusBadge>
            <span className="font-mono text-xs">
              {new Date(c.createdAt).toLocaleString()}
            </span>
          </span>
        }
      />

      <DetailLayout
        aside={
          <CaseActions
            caseId={String(c._id)}
            status={c.status}
            currentUserId={user?.sub ?? ""}
            assignedToMe={assignedToMe}
          />
        }
      >
        <DetailCard>
          <DetailRow label="Patient">{c.patient.name}</DetailRow>
          <DetailRow label="Country">{c.patient.country}</DetailRow>
          <DetailRow label="Email">{c.patient.email}</DetailRow>
          <DetailRow label="Phone">{c.patient.phone}</DetailRow>
          {c.requestedService && (
            <DetailRow label="Requested">{c.requestedService}</DetailRow>
          )}
          {hospital && (
            <DetailRow label="Hospital">{localize(hospital.name, l)}</DetailRow>
          )}
          {doctor && <DetailRow label="Doctor">{doctor.name}</DetailRow>}
          {pkg && (
            <DetailRow label="Package">{localize(pkg.name, l)}</DetailRow>
          )}
        </DetailCard>

        {c.diagnosis && (
          <DetailCard title="Diagnosis / notes">
            <DetailProse>{c.diagnosis}</DetailProse>
          </DetailCard>
        )}

        <DetailCard title="Medical documents">
          <CaseDocumentViewer
            caseId={String(c._id)}
            documents={(c.documents ?? []).map((d) => ({ name: d.name }))}
          />
        </DetailCard>

        <DetailCard title="Arrangement checklist">
          <CaseChecklist
            caseId={String(c._id)}
            initial={c.arrangementChecklist}
          />
        </DetailCard>

        {c.quotation?.amountMinor != null && (
          <DetailCard
            title="Current quotation"
            action={
              <Link
                href={`/admin/tourism/cases/${String(c._id)}/quotation`}
                className="text-primary text-[13px] font-medium hover:underline"
              >
                Printable view →
              </Link>
            }
          >
            <DetailRow label="Amount">
              {formatBDT(c.quotation.amountMinor)}
            </DetailRow>
            {c.quotation.validUntil && (
              <DetailRow label="Valid until">
                {new Date(c.quotation.validUntil).toLocaleDateString()}
              </DetailRow>
            )}
            {c.quotation.notes && (
              <DetailProse>{c.quotation.notes}</DetailProse>
            )}
          </DetailCard>
        )}

        {c.activity.length > 0 && (
          <DetailCard
            title="Activity"
            bodyClassName="divide-border/60 gap-0 divide-y py-0"
          >
            {c.activity.map((n, i) => (
              <div key={i} className="grid gap-0.5 py-2.5">
                <span className="text-foreground">{n.body}</span>
                <span className="text-muted-foreground text-xs">
                  {new Date(n.at).toLocaleString()}
                </span>
              </div>
            ))}
          </DetailCard>
        )}
      </DetailLayout>
    </div>
  );
}
