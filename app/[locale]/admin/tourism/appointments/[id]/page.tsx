import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AppointmentActions } from "@/components/admin/appointment-actions";
import { getAppointmentByIdLean } from "@/lib/repositories/appointments.repo";
import { getDoctorByIdLean } from "@/lib/repositories/doctors.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { EditorHeader } from "@/components/admin/ui/form-shell";
import {
  DetailCard,
  DetailLayout,
  DetailProse,
  DetailRow,
} from "@/components/admin/ui/detail";
import { StatusBadge } from "@/components/admin/ui/status-badge";

export const dynamic = "force-dynamic";

export default async function AdminAppointmentDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const a = await getAppointmentByIdLean(id).catch(() => null);
  if (!a) notFound();
  const user = await getSessionUser();
  const assignedToMe = Boolean(
    user && a.assignedTo && String(a.assignedTo) === user.sub,
  );
  const doctor = a.doctorId
    ? await getDoctorByIdLean(String(a.doctorId))
    : null;

  return (
    <div className="space-y-4">
      <EditorHeader
        backHref="/admin/tourism/appointments"
        backLabel="Appointments"
        title={a.appointmentNumber}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">
              {a.type.replace(/_/g, "")}
            </span>
            <StatusBadge>{a.status}</StatusBadge>
            <span className="font-mono text-xs">
              {new Date(a.createdAt).toLocaleString()}
            </span>
          </span>
        }
      />

      <DetailLayout
        aside={
          <AppointmentActions
            appointmentId={String(a._id)}
            status={a.status}
            type={a.type}
            currentUserId={user?.sub ?? ""}
            assignedToMe={assignedToMe}
          />
        }
      >
        <DetailCard>
          <DetailRow label="Patient">{a.patient.name}</DetailRow>
          <DetailRow label="Email">{a.patient.email}</DetailRow>
          <DetailRow label="Phone">{a.patient.phone}</DetailRow>
          {doctor && <DetailRow label="Doctor">{doctor.name}</DetailRow>}
          {a.preferredTimes.length > 0 && (
            <DetailRow label="Preferred times">
              {a.preferredTimes.join(", ")}
            </DetailRow>
          )}
          {a.scheduledFor && (
            <DetailRow label="Scheduled for">
              {new Date(a.scheduledFor).toLocaleString()}
            </DetailRow>
          )}
          {a.meetingLink && (
            <div className="grid gap-1">
              <span className="text-muted-foreground">Meeting link</span>
              <a
                href={a.meetingLink}
                target="_blank"
                rel="noreferrer"
                className="text-primary break-all hover:underline"
              >
                {a.meetingLink}
              </a>
            </div>
          )}
        </DetailCard>

        {a.notes && (
          <DetailCard title="Notes">
            <DetailProse>{a.notes}</DetailProse>
          </DetailCard>
        )}

        {a.activity.length > 0 && (
          <DetailCard
            title="Activity"
            bodyClassName="divide-border/60 gap-0 divide-y py-0"
          >
            {a.activity.map((n, i) => (
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
