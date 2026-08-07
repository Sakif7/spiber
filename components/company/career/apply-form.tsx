"use client";

import { useRef, useState, type CSSProperties } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, FileText, Upload } from "lucide-react";
import { Link } from "@/i18n/navigation";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const label: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--color-text-strong)",
};
const input: CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: "var(--r-md)",
  border: "1px solid var(--color-border-field)",
  background: "var(--color-surface)",
  fontSize: 15,
  fontFamily: "inherit",
  color: "var(--color-text-strong)",
  outline: "none",
};

type FieldErrors = Partial<
  Record<"name" | "email" | "phone" | "resume", string>
>;

export function ApplyForm({ jobId }: { jobId: string }) {
  const t = useTranslations("career.form");
  const locale = useLocale();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [resume, setResume] = useState<{ key: string; name: string } | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onPickFile(file: File) {
    setErrors((e) => ({ ...e, resume: undefined }));
    if (file.size > MAX_BYTES) {
      setErrors((e) => ({ ...e, resume: t("errors.tooLarge") }));
      return;
    }
    if (!ALLOWED.has(file.type)) {
      setErrors((e) => ({ ...e, resume: t("errors.badType") }));
      return;
    }
    setUploading(true);
    setFormError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/careers/apply/upload", {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setResume({ key: json.data.key, name: json.data.name });
      } else {
        const code = json?.error?.code;
        setErrors((e) => ({
          ...e,
          resume:
            code === "too_large"
              ? t("errors.tooLarge")
              : code === "bad_type"
                ? t("errors.badType")
                : t("errors.uploadFailed"),
        }));
      }
    } catch {
      setErrors((e) => ({ ...e, resume: t("errors.uploadFailed") }));
    } finally {
      setUploading(false);
    }
  }

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = t("errors.name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = t("errors.email");
    if (!phone.trim()) next.phone = t("errors.phone");
    if (!resume) next.resume = t("errors.resume");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/careers/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          coverLetter: coverLetter.trim() || undefined,
          resumeKey: resume!.key,
          resumeName: resume!.name,
          locale,
          website,
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setSuccess(json.data.applicationNumber);
      } else {
        setFormError(t("errors.generic"));
      }
    } catch {
      setFormError(t("errors.generic"));
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div
        style={{
          display: "grid",
          gap: 14,
          justifyItems: "center",
          textAlign: "center",
          padding: "clamp(28px, 4vw, 48px)",
          borderRadius: "var(--r-xl)",
          border: "1px solid var(--color-hairline)",
          background: "var(--color-surface)",
        }}
      >
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 56,
            height: 56,
            borderRadius: "var(--r-pill)",
            background: "var(--color-brand-soft)",
            color: "var(--color-brand)",
          }}
        >
          <CheckCircle2 size={30} strokeWidth={1.6} aria-hidden />
        </span>
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 22,
            color: "var(--color-text-strong)",
            margin: 0,
          }}
        >
          {t("success.title")}
        </h3>
        <p
          style={{
            margin: 0,
            color: "var(--color-text-muted)",
            maxWidth: "44ch",
          }}
        >
          {t("success.body")}
        </p>
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            color: "var(--color-text-subtle)",
          }}
        >
          {t("success.reference")}: {success}
        </p>
        <Link
          href="/company/career"
          style={{
            marginTop: 4,
            color: "var(--color-brand-deep)",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {t("success.another")}
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      style={{ display: "grid", gap: "var(--s-4)" }}
      noValidate
    >
      {/* Honeypot — hidden from real users */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        aria-hidden
        style={{
          position: "absolute",
          left: "-9999px",
          width: 1,
          height: 1,
          opacity: 0,
        }}
      />

      <Field label={t("name")} error={errors.name}>
        <input
          className="apply-input"
          style={input}
          value={name}
          maxLength={120}
          placeholder={t("namePlaceholder")}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--s-4)",
        }}
        className="apply-row"
      >
        <Field label={t("email")} error={errors.email}>
          <input
            className="apply-input"
            style={input}
            type="email"
            value={email}
            maxLength={160}
            placeholder={t("emailPlaceholder")}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label={t("phone")} error={errors.phone}>
          <input
            className="apply-input"
            style={input}
            value={phone}
            maxLength={40}
            placeholder={t("phonePlaceholder")}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
      </div>

      <Field label={t("resume")} error={errors.resume}>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPickFile(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            borderRadius: "var(--r-md)",
            border: "1px dashed var(--color-border)",
            background: "var(--color-surface)",
            color: resume
              ? "var(--color-text-strong)"
              : "var(--color-text-muted)",
            fontSize: 14,
            fontFamily: "inherit",
            cursor: uploading ? "default" : "pointer",
            width: "100%",
            justifyContent: "flex-start",
          }}
        >
          {resume ? (
            <FileText size={18} aria-hidden />
          ) : (
            <Upload size={18} aria-hidden />
          )}
          {uploading ? t("uploading") : resume ? resume.name : t("uploadCta")}
        </button>
        <span style={{ fontSize: 12, color: "var(--color-text-subtle)" }}>
          {t("resumeHint")}
        </span>
      </Field>

      <Field label={t("coverLetter")}>
        <textarea
          className="apply-input"
          style={{ ...input, minHeight: 120, resize: "vertical" }}
          value={coverLetter}
          maxLength={5000}
          placeholder={t("coverLetterPlaceholder")}
          onChange={(e) => setCoverLetter(e.target.value)}
        />
      </Field>

      {formError && (
        <p style={{ margin: 0, color: "var(--color-error)", fontSize: 14 }}>
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || uploading}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "13px 24px",
          borderRadius: "var(--r-pill)",
          background: "var(--color-brand)",
          color: "#fff",
          border: "none",
          fontWeight: 600,
          fontSize: 15,
          fontFamily: "inherit",
          cursor: submitting || uploading ? "default" : "pointer",
          opacity: submitting || uploading ? 0.7 : 1,
          boxShadow: "var(--shadow-brand)",
          width: "fit-content",
        }}
      >
        {submitting ? t("submitting") : t("submit")}
      </button>
      <span style={{ fontSize: 12, color: "var(--color-text-subtle)" }}>
        {t("secure")}
      </span>

      <style>{`
        .apply-input:focus { border-color: var(--teal-300); box-shadow: 0 0 0 3px var(--color-brand-soft); }
        @media (max-width: 560px) { .apply-row { grid-template-columns: 1fr !important; } }
      `}</style>
    </form>
  );
}

function Field({
  label: lbl,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <span style={label}>{lbl}</span>
      {children}
      {error && (
        <span style={{ color: "var(--color-error)", fontSize: 12.5 }}>
          {error}
        </span>
      )}
    </div>
  );
}
