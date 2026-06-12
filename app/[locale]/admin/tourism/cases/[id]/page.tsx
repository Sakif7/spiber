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

export default async function AdminCaseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const l = locale === "bn" ? "bn" : "en";

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
          {c.caseNumber}
        </h1>
        <span style={{ ...muted, fontFamily: "var(--font-mono)" }}>
          {c.status.replace(/_/g, " ")} ·{" "}
          {new Date(c.createdAt).toLocaleString()}
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
            <Row label="Patient" value={c.patient.name} />
            <Row label="Country" value={c.patient.country} />
            <Row label="Email" value={c.patient.email} />
            <Row label="Phone" value={c.patient.phone} />
            {c.requestedService && (
              <Row label="Requested" value={c.requestedService} />
            )}
            {hospital && (
              <Row label="Hospital" value={localize(hospital.name, l)} />
            )}
            {doctor && <Row label="Doctor" value={doctor.name} />}
            {pkg && <Row label="Package" value={localize(pkg.name, l)} />}
          </section>

          {c.diagnosis && (
            <section style={card}>
              <strong style={{ color: "var(--color-text-strong)" }}>
                Diagnosis / notes
              </strong>
              <p style={{ margin: 0, whiteSpace: "pre-line" }}>{c.diagnosis}</p>
            </section>
          )}

          <section style={card}>
            <strong style={{ color: "var(--color-text-strong)" }}>
              Medical documents
            </strong>
            <CaseDocumentViewer
              caseId={String(c._id)}
              documents={(c.documents ?? []).map((d) => ({ name: d.name }))}
            />
          </section>

          <section style={card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <strong style={{ color: "var(--color-text-strong)" }}>
                Arrangement checklist
              </strong>
            </div>
            <CaseChecklist
              caseId={String(c._id)}
              initial={c.arrangementChecklist}
            />
          </section>

          {c.quotation?.amountMinor != null && (
            <section style={card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <strong style={{ color: "var(--color-text-strong)" }}>
                  Current quotation
                </strong>
                <Link
                  href={`/admin/tourism/cases/${String(c._id)}/quotation`}
                  style={{
                    color: "var(--color-brand-deep)",
                    fontSize: "var(--fs-body-sm)",
                  }}
                >
                  Printable view →
                </Link>
              </div>
              <Row label="Amount" value={formatBDT(c.quotation.amountMinor)} />
              {c.quotation.validUntil && (
                <Row
                  label="Valid until"
                  value={new Date(c.quotation.validUntil).toLocaleDateString()}
                />
              )}
              {c.quotation.notes && (
                <p style={{ margin: 0 }}>{c.quotation.notes}</p>
              )}
            </section>
          )}

          {c.activity.length > 0 && (
            <section style={card}>
              <strong style={{ color: "var(--color-text-strong)" }}>
                Activity
              </strong>
              {c.activity.map((n, i) => (
                <div key={i} style={{ display: "grid", gap: 2 }}>
                  <span style={{ color: "var(--color-text)" }}>{n.body}</span>
                  <span style={muted}>{new Date(n.at).toLocaleString()}</span>
                </div>
              ))}
            </section>
          )}
        </div>

        <CaseActions
          caseId={String(c._id)}
          status={c.status}
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
