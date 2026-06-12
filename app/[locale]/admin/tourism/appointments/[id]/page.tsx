import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AppointmentActions } from "@/components/admin/appointment-actions";
import { getAppointmentByIdLean } from "@/lib/repositories/appointments.repo";
import { getDoctorByIdLean } from "@/lib/repositories/doctors.repo";
import { getSessionUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

const card: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  borderRadius: "var(--r-lg)",
  padding: "var(--s-5)",
  display: "grid",
  gap: "var(--s-3)",
};
const muted: React.CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: "var(--fs-body-sm)",
};

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
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <div style={{ display: "grid", gap: 4 }}>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-2xl)",
            color: "var(--color-text-strong)",
          }}
        >
          {a.appointmentNumber}
        </h1>
        <span style={{ ...muted, fontFamily: "var(--font-mono)" }}>
          {a.type.replace(/_/g, " ")} · {a.status} ·{" "}
          {new Date(a.createdAt).toLocaleString()}
        </span>
      </div>

      <div
        className="equal-2col"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
          gap: "var(--s-5)",
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: "var(--s-5)" }}>
          <section style={card}>
            <Row label="Patient" value={a.patient.name} />
            <Row label="Email" value={a.patient.email} />
            <Row label="Phone" value={a.patient.phone} />
            {doctor && <Row label="Doctor" value={doctor.name} />}
            {a.preferredTimes.length > 0 && (
              <Row
                label="Preferred times"
                value={a.preferredTimes.join(", ")}
              />
            )}
            {a.scheduledFor && (
              <Row
                label="Scheduled for"
                value={new Date(a.scheduledFor).toLocaleString()}
              />
            )}
            {a.meetingLink && (
              <div style={{ display: "grid", gap: 4 }}>
                <span style={muted}>Meeting link</span>
                <a
                  href={a.meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: "var(--color-brand-deep)",
                    wordBreak: "break-all",
                  }}
                >
                  {a.meetingLink}
                </a>
              </div>
            )}
          </section>

          {a.notes && (
            <section style={card}>
              <strong style={{ color: "var(--color-text-strong)" }}>
                Notes
              </strong>
              <p style={{ margin: 0, whiteSpace: "pre-line" }}>{a.notes}</p>
            </section>
          )}

          {a.activity.length > 0 && (
            <section style={card}>
              <strong style={{ color: "var(--color-text-strong)" }}>
                Activity
              </strong>
              {a.activity.map((n, i) => (
                <div key={i} style={{ display: "grid", gap: 2 }}>
                  <span style={{ color: "var(--color-text)" }}>{n.body}</span>
                  <span style={muted}>{new Date(n.at).toLocaleString()}</span>
                </div>
              ))}
            </section>
          )}
        </div>

        <AppointmentActions
          appointmentId={String(a._id)}
          status={a.status}
          type={a.type}
          currentUserId={user?.sub ?? ""}
          assignedToMe={assignedToMe}
        />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "var(--s-4)",
      }}
    >
      <span
        style={{
          color: "var(--color-text-muted)",
          fontSize: "var(--fs-body-sm)",
        }}
      >
        {label}
      </span>
      <strong
        style={{
          color: "var(--color-text-strong)",
          wordBreak: "break-all",
          textAlign: "right",
        }}
      >
        {value}
      </strong>
    </div>
  );
}
