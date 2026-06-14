"use client";

import {
  useState,
  type CSSProperties,
  type ReactNode,
  type ChangeEvent,
} from "react";
import { useTranslations, useLocale } from "next-intl";
import { CtaButton } from "@/components/ui/cta-button";
import { formatBDT } from "@/lib/money";
import { asLocale } from "@/lib/i18n/intl-locale";

/* ------------------------------------------------------------- primitives */
const input: CSSProperties = {
  font: "inherit",
  padding: "10px 12px",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-sm)",
  background: "var(--color-surface)",
  width: "100%",
};
const lbl: CSSProperties = {
  fontSize: "var(--fs-caption)",
  color: "var(--color-text-muted)",
  fontWeight: 600,
};
const err: CSSProperties = {
  color: "var(--color-error)",
  fontSize: "var(--fs-sm)",
  margin: 0,
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={lbl}>{label}</span>
      {children}
      {hint && (
        <span
          style={{
            fontSize: "var(--fs-caption)",
            color: "var(--color-text-subtle)",
          }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

const card: CSSProperties = {
  display: "grid",
  gap: "var(--s-4)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-lg)",
  background: "var(--color-surface)",
  padding: "clamp(20px, 3vw, 32px)",
  maxWidth: 640,
};

function Success({
  title,
  body,
  reference,
}: {
  title: string;
  body: string;
  reference?: string;
}) {
  return (
    <div style={{ ...card, borderColor: "var(--color-secondary)" }}>
      <strong
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--fs-xl)",
          color: "var(--color-text-strong)",
        }}
      >
        {title}
      </strong>
      <p style={{ margin: 0, color: "var(--color-text-muted)" }}>{body}</p>
      {reference && (
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-mono)",
            color: "var(--color-text-strong)",
          }}
        >
          {reference}
        </p>
      )}
    </div>
  );
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok && json?.ok, json } as const;
}

/* ------------------------------------------------------------- Case form */
type Doc = { name: string; fileKey: string; contentType?: string };

export function CaseForm({
  hospitalId,
  doctorId,
  packageId,
  contextLabel,
}: {
  hospitalId?: string;
  doctorId?: string;
  packageId?: string;
  contextLabel?: string;
}) {
  const t = useTranslations("tourism.case");
  const locale = useLocale();
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [requestedService, setRequestedService] = useState("");
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [consent, setConsent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState<string | null>(null);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!consent) {
      setError(t("privacyNotice"));
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("consent", "true");
      const res = await fetch("/api/tourism/cases/uploads", {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setDocuments((d) => [
          ...d,
          {
            name: json.data.name,
            fileKey: json.data.key,
            contentType: json.data.contentType,
          },
        ]);
      } else {
        setError("Upload failed.");
      }
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!name || !country || !email || !phone) {
      setError("Please complete the required fields.");
      return;
    }
    if (!consent) {
      setError(t("privacyNotice"));
      return;
    }
    setBusy(true);
    setError(null);
    const { ok, json } = await postJson("/api/tourism/cases", {
      patient: { name, country, email, phone },
      diagnosis: diagnosis || undefined,
      requestedService: requestedService || undefined,
      documents,
      hospitalId,
      doctorId,
      packageId,
      consent: true,
      locale,
    });
    setBusy(false);
    if (ok) setRef(json.data.caseNumber);
    else setError("Could not submit. Please try again.");
  }

  if (ref)
    return (
      <Success
        title={t("successTitle")}
        body={t("successBody")}
        reference={`${t("reference")}: ${ref}`}
      />
    );

  return (
    <div style={card}>
      {contextLabel && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: "var(--r-sm)",
            background: "var(--color-secondary-soft)",
            color: "var(--color-text-strong)",
            fontSize: "var(--fs-body-sm)",
          }}
        >
          {contextLabel}
        </div>
      )}
      {error && <p style={err}>{error}</p>}
      <div
        style={{
          display: "grid",
          gap: "var(--s-3)",
          gridTemplateColumns: "1fr 1fr",
        }}
      >
        <Field label={t("name")}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            style={input}
          />
        </Field>
        <Field label={t("country")}>
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            maxLength={80}
            style={input}
          />
        </Field>
        <Field label={t("email")}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={input}
          />
        </Field>
        <Field label={t("phone")}>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={40}
            style={input}
          />
        </Field>
      </div>
      <Field label={t("requestedService")} hint={t("requestedServiceHint")}>
        <input
          value={requestedService}
          onChange={(e) => setRequestedService(e.target.value)}
          maxLength={300}
          style={input}
        />
      </Field>
      <Field label={t("diagnosis")} hint={t("diagnosisHint")}>
        <textarea
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          rows={4}
          maxLength={5000}
          style={input}
        />
      </Field>

      <Field label={t("documents")} hint={t("documentsHint")}>
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={onFile}
          disabled={!consent || uploading}
          style={{ ...input, padding: 8 }}
        />
      </Field>
      {uploading && (
        <span style={{ fontSize: "var(--fs-caption)" }}>{t("uploading")}</span>
      )}
      {documents.length > 0 && (
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            color: "var(--color-success)",
            fontSize: "var(--fs-body-sm)",
          }}
        >
          {documents.map((d, i) => (
            <li key={i}>✓ {d.name}</li>
          ))}
        </ul>
      )}

      <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          style={{ marginTop: 3 }}
        />
        <span
          style={{ fontSize: "var(--fs-body-sm)", color: "var(--color-text)" }}
        >
          {t("consent")}
        </span>
      </label>
      <span
        style={{
          fontSize: "var(--fs-caption)",
          color: "var(--color-text-subtle)",
        }}
      >
        {t("privacyNotice")}
      </span>

      <div>
        <CtaButton onClick={submit}>
          {busy ? t("submitting") : t("submit")}
        </CtaButton>
      </div>
    </div>
  );
}

/* -------------------------------------------------------- Appointment form */
export function AppointmentForm({
  doctorId,
  contextLabel,
}: {
  doctorId?: string;
  contextLabel?: string;
}) {
  const t = useTranslations("tourism.appointment");
  const c = useTranslations("tourism.case");
  const locale = useLocale();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState("teleconsultation");
  const [times, setTimes] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState<string | null>(null);

  async function submit() {
    if (!name || !email || !phone) {
      setError("Please complete the required fields.");
      return;
    }
    setBusy(true);
    setError(null);
    const { ok, json } = await postJson("/api/tourism/appointments", {
      patient: { name, email, phone },
      doctorId,
      type,
      preferredTimes: times
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      notes: notes || undefined,
      locale,
    });
    setBusy(false);
    if (ok) setRef(json.data.appointmentNumber);
    else setError("Could not submit. Please try again.");
  }

  if (ref)
    return (
      <Success
        title={t("successTitle")}
        body={t("successBody")}
        reference={ref}
      />
    );

  return (
    <div style={card}>
      {contextLabel && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: "var(--r-sm)",
            background: "var(--color-secondary-soft)",
            fontSize: "var(--fs-body-sm)",
          }}
        >
          {contextLabel}
        </div>
      )}
      <p
        style={{
          margin: 0,
          color: "var(--color-text-muted)",
          fontSize: "var(--fs-body-sm)",
        }}
      >
        {t("requestNotice")}
      </p>
      {error && <p style={err}>{error}</p>}
      <div
        style={{
          display: "grid",
          gap: "var(--s-3)",
          gridTemplateColumns: "1fr 1fr",
        }}
      >
        <Field label={c("name")}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={input}
          />
        </Field>
        <Field label={c("email")}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={input}
          />
        </Field>
        <Field label={c("phone")}>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={input}
          />
        </Field>
        <Field label={t("type")}>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            style={input}
          >
            <option value="teleconsultation">{t("teleconsultation")}</option>
            <option value="in_person">{t("inPerson")}</option>
          </select>
        </Field>
      </div>
      <Field label={t("preferredTimes")} hint={t("preferredHint")}>
        <textarea
          value={times}
          onChange={(e) => setTimes(e.target.value)}
          rows={3}
          style={input}
        />
      </Field>
      <Field label={t("notes")}>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          style={input}
        />
      </Field>
      <div>
        <CtaButton onClick={submit}>
          {busy ? c("submitting") : t("submit")}
        </CtaButton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Travel form */
type TravelType = "air" | "hotel" | "visa" | "transfer";

export function TravelForm({ type }: { type: TravelType }) {
  const t = useTranslations("tourism.travel");
  const c = useTranslations("tourism.case");
  const locale = useLocale();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [details, setDetails] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState<string | null>(null);

  const set =
    (k: string) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDetails((d) => ({ ...d, [k]: e.target.value }));

  const FIELDS: Record<TravelType, { key: string; label: string }[]> = {
    air: [
      { key: "from", label: t("air.from") },
      { key: "to", label: t("air.to") },
      { key: "departDate", label: t("air.departDate") },
      { key: "returnDate", label: t("air.returnDate") },
      { key: "passengers", label: t("air.passengers") },
    ],
    hotel: [
      { key: "city", label: t("hotel.city") },
      { key: "checkIn", label: t("hotel.checkIn") },
      { key: "checkOut", label: t("hotel.checkOut") },
      { key: "guests", label: t("hotel.guests") },
    ],
    visa: [
      { key: "country", label: t("visa.country") },
      { key: "travelDate", label: t("visa.travelDate") },
      { key: "notes", label: t("visa.notes") },
    ],
    transfer: [
      { key: "city", label: t("transfer.city") },
      { key: "date", label: t("transfer.date") },
      { key: "notes", label: t("transfer.notes") },
    ],
  };

  async function submit() {
    if (!name || !email || !phone) {
      setError("Please complete the required fields.");
      return;
    }
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(details))
      if (v.trim()) cleaned[k] = v.trim();
    setBusy(true);
    setError(null);
    const { ok, json } = await postJson("/api/tourism/travel", {
      type,
      details: cleaned,
      contact: { name, email, phone },
      locale,
    });
    setBusy(false);
    if (ok) setRef(json.data.travelRequestNumber);
    else setError("Could not submit. Please try again.");
  }

  if (ref)
    return (
      <Success
        title={t("successTitle")}
        body={t("successBody")}
        reference={ref}
      />
    );

  return (
    <div style={card}>
      <p
        style={{
          margin: 0,
          color: "var(--color-text-muted)",
          fontSize: "var(--fs-body-sm)",
        }}
      >
        {t("requestNotice")}
      </p>
      {error && <p style={err}>{error}</p>}
      <div
        style={{
          display: "grid",
          gap: "var(--s-3)",
          gridTemplateColumns: "1fr 1fr",
        }}
      >
        {FIELDS[type].map((f) => (
          <Field key={f.key} label={f.label}>
            <input
              value={details[f.key] ?? ""}
              onChange={set(f.key)}
              style={input}
            />
          </Field>
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gap: "var(--s-3)",
          gridTemplateColumns: "1fr 1fr",
        }}
      >
        <Field label={c("name")}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={input}
          />
        </Field>
        <Field label={c("email")}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={input}
          />
        </Field>
        <Field label={c("phone")}>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={input}
          />
        </Field>
      </div>
      <div>
        <CtaButton onClick={submit}>
          {busy ? c("submitting") : t("submit")}
        </CtaButton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Partner form */
export function PartnerForm() {
  const t = useTranslations("tourism.partner");
  const c = useTranslations("tourism.case");
  const locale = useLocale();
  const [org, setOrg] = useState("");
  const [website, setWebsite] = useState("");
  const [country, setCountry] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("hospital");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState<string | null>(null);

  async function submit() {
    if (!org || !name || !email || !phone) {
      setError("Please complete the required fields.");
      return;
    }
    setBusy(true);
    setError(null);
    const { ok, json } = await postJson("/api/tourism/partner", {
      type,
      orgInfo: {
        name: org,
        website: website || undefined,
        country: country || undefined,
        description: description || undefined,
      },
      contact: { name, email, phone },
      locale,
    });
    setBusy(false);
    if (ok) setRef(json.data.partnerApplicationNumber);
    else setError("Could not submit. Please try again.");
  }

  if (ref)
    return (
      <Success
        title={t("successTitle")}
        body={t("successBody")}
        reference={ref}
      />
    );

  return (
    <div style={card}>
      {error && <p style={err}>{error}</p>}
      <Field label={t("type")}>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={input}
        >
          {(
            ["hospital", "doctor", "agency", "diagnostic", "insurance"] as const
          ).map((k) => (
            <option key={k} value={k}>
              {t(`types.${k}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("org")}>
        <input
          value={org}
          onChange={(e) => setOrg(e.target.value)}
          style={input}
        />
      </Field>
      <div
        style={{
          display: "grid",
          gap: "var(--s-3)",
          gridTemplateColumns: "1fr 1fr",
        }}
      >
        <Field label={t("website")}>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            style={input}
          />
        </Field>
        <Field label={t("country")}>
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            style={input}
          />
        </Field>
      </div>
      <Field label={t("description")}>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          style={input}
        />
      </Field>
      <div
        style={{
          display: "grid",
          gap: "var(--s-3)",
          gridTemplateColumns: "1fr 1fr 1fr",
        }}
      >
        <Field label={t("contactName")}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={input}
          />
        </Field>
        <Field label={c("email")}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={input}
          />
        </Field>
        <Field label={c("phone")}>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={input}
          />
        </Field>
      </div>
      <div>
        <CtaButton onClick={submit}>
          {busy ? c("submitting") : t("submit")}
        </CtaButton>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- Case lookup form */
export function CaseLookupForm() {
  const t = useTranslations("tourism.lookup");
  const st = useTranslations("tourism.status.case");
  const cl = useTranslations("tourism.checklist");
  const locale = useLocale();
  const [caseNumber, setCaseNumber] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  type Result = {
    caseNumber: string;
    status: string;
    checklist?: Record<string, { done: boolean }>;
    quotation?: { amountMinor?: number | null } | null;
  };
  const [result, setResult] = useState<Result | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    setResult(null);
    const { ok, json } = await postJson("/api/tourism/cases/lookup", {
      caseNumber: caseNumber.trim(),
      email: email.trim(),
    });
    setBusy(false);
    if (ok) setResult(json.data as Result);
    else setError(t("notFound"));
  }

  return (
    <div style={{ display: "grid", gap: "var(--s-5)" }}>
      <div style={card}>
        {error && <p style={err}>{error}</p>}
        <Field label={t("caseNumber")}>
          <input
            value={caseNumber}
            onChange={(e) => setCaseNumber(e.target.value)}
            placeholder="SPM-CASE-…"
            style={input}
          />
        </Field>
        <Field label={t("email")}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={input}
          />
        </Field>
        <div>
          <CtaButton onClick={submit}>{busy ? "…" : t("submit")}</CtaButton>
        </div>
      </div>

      {result && (
        <div style={card}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--color-text-strong)",
              }}
            >
              {result.caseNumber}
            </span>
            <span
              style={{
                padding: "4px 12px",
                borderRadius: "var(--r-pill)",
                background: "var(--color-secondary-soft)",
                color: "var(--color-secondary-deep, var(--color-text-strong))",
                fontWeight: 600,
                fontSize: "var(--fs-caption)",
              }}
            >
              {st(result.status)}
            </span>
          </div>
          {result.quotation?.amountMinor != null && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={lbl}>{t("quotation")}</span>
              <strong>
                {formatBDT(result.quotation.amountMinor, asLocale(locale))}
              </strong>
            </div>
          )}
          {result.checklist && (
            <div style={{ display: "grid", gap: 6 }}>
              <span style={lbl}>{t("checklist")}</span>
              {Object.entries(result.checklist).map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "var(--fs-body-sm)",
                  }}
                >
                  <span>{cl(k)}</span>
                  <span
                    style={{
                      color: v.done
                        ? "var(--color-success)"
                        : "var(--color-text-muted)",
                    }}
                  >
                    {v.done ? cl("done") : cl("pending")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
