"use client";

import { CSSProperties, useId, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { Mail, Send, ShieldCheck, CheckCircle2, RotateCcw } from "lucide-react";
import { COUNTRIES, PRIORITY_COUNTRY } from "@/lib/countries";

type InquiryType =
  | ""
  | "sales"
  | "support"
  | "quotation"
  | "partnership"
  | "training";

type Values = {
  name: string;
  email: string;
  phone: string;
  country: string;
  inquiryType: InquiryType;
  message: string;
};

type FieldErrors = Partial<Record<keyof Values, string>>;

const EMPTY: Values = {
  name: "",
  email: "",
  phone: "",
  country: "",
  inquiryType: "",
  message: "",
};

const FIELD_ORDER: (keyof Values)[] = [
  "name",
  "email",
  "phone",
  "country",
  "inquiryType",
  "message",
];

const INQUIRY_OPTIONS = [
  "sales",
  "support",
  "quotation",
  "partnership",
  "training",
] as const;

const labelStyle: CSSProperties = {
  fontSize: "var(--fs-small)",
  fontWeight: 500,
  color: "var(--color-text)",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

const errStyle: CSSProperties = {
  color: "var(--color-error)",
  fontSize: "var(--fs-caption)",
  marginTop: 2,
};

/**
 * Contact "Send us a message" card — labeled inputs with inline (client-side)
 * validation that names the failing field, a routed Inquiry Type, a spam
 * honeypot, and success/error states that never discard the user's input.
 */
export function ContactForm() {
  const t = useTranslations("contact.form");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const uid = useId();

  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [doneRef, setDoneRef] = useState<string | null>(null);

  function update<K extends keyof Values>(key: K, val: Values[K]) {
    setValues((s) => ({ ...s, [key]: val }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
    if (serverError) setServerError(null);
  }

  function validate(v: Values): FieldErrors {
    const e: FieldErrors = {};
    if (!v.name.trim()) e.name = t("errors.name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim()))
      e.email = t("errors.email");
    if (v.phone.trim().length < 3) e.phone = t("errors.phone");
    if (!v.country) e.country = t("errors.country");
    if (!v.inquiryType) e.inquiryType = t("errors.inquiryType");
    if (!v.message.trim()) e.message = t("errors.message");
    return e;
  }

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setServerError(null);
    const found = validate(values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      const first = FIELD_ORDER.find((k) => found[k]);
      if (first) document.getElementById(`${uid}-${first}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, website, locale }),
      });
      const json = await res.json().catch(() => null);
      setBusy(false);
      if (res.ok && json?.ok) {
        setDoneRef(String(json.data.contactNumber));
      } else {
        setServerError(t("error"));
      }
    } catch {
      setBusy(false);
      setServerError(t("error"));
    }
  }

  function reset() {
    setValues(EMPTY);
    setErrors({});
    setWebsite("");
    setDoneRef(null);
    setServerError(null);
  }

  const cardStyle: CSSProperties = {
    background: "var(--color-surface)",
    border: "1px solid var(--color-hairline)",
    borderRadius: "var(--radius-xl)",
    boxShadow: "var(--shadow-md)",
    padding: "clamp(22px, 3vw, 34px)",
    height: "100%",
  };

  if (doneRef) {
    return (
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        style={{
          ...cardStyle,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 14,
          minHeight: 360,
          justifyContent: "center",
        }}
      >
        <span
          style={{
            width: 60,
            height: 60,
            borderRadius: "var(--radius-pill)",
            display: "grid",
            placeItems: "center",
            background: "color-mix(in oklab, var(--color-success) 14%, #fff)",
            color: "var(--color-success)",
          }}
        >
          <CheckCircle2 size={30} strokeWidth={2} />
        </span>
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-h4)",
            fontWeight: 600,
            color: "var(--color-text-strong)",
          }}
        >
          {t("success.title")}
        </h3>
        <p
          style={{
            color: "var(--color-text-muted)",
            fontSize: "var(--fs-body-sm)",
            maxWidth: "38ch",
            lineHeight: 1.6,
          }}
        >
          {t("success.body")}
        </p>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-caption)",
            color: "var(--color-text-muted)",
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-hairline)",
            borderRadius: "var(--radius-pill)",
            padding: "5px 12px",
          }}
        >
          {t("success.reference")}: {doneRef}
        </span>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 6,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "transparent",
            border: "1px solid var(--color-hairline)",
            borderRadius: "var(--radius-pill)",
            padding: "9px 18px",
            fontSize: "var(--fs-small)",
            fontWeight: 500,
            color: "var(--color-text)",
            cursor: "pointer",
          }}
        >
          <RotateCcw size={14} /> {t("success.again")}
        </button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate style={cardStyle}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          gap: 14,
          alignItems: "center",
          marginBottom: 22,
        }}
      >
        <span
          style={{
            flexShrink: 0,
            width: 46,
            height: 46,
            borderRadius: "var(--radius-md)",
            display: "grid",
            placeItems: "center",
            background: "var(--color-brand-soft)",
            color: "var(--color-brand-deep)",
          }}
        >
          <Mail size={22} strokeWidth={1.8} />
        </span>
        <div>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--fs-h4)",
              fontWeight: 600,
              color: "var(--color-text-strong)",
              letterSpacing: "-0.01em",
            }}
          >
            {t("title")}
          </h2>
          <p
            style={{
              fontSize: "var(--fs-small)",
              color: "var(--color-text-muted)",
              marginTop: 2,
              lineHeight: 1.5,
            }}
          >
            {t("subtitle")}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        {/* Name + Email */}
        <div
          className="equal-2col"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          <Field
            id={`${uid}-name`}
            label={t("name")}
            error={errors.name}
            required
          >
            <input
              id={`${uid}-name`}
              className="contact-field"
              type="text"
              autoComplete="name"
              maxLength={120}
              placeholder={t("namePlaceholder")}
              value={values.name}
              aria-invalid={!!errors.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </Field>
          <Field
            id={`${uid}-email`}
            label={t("email")}
            error={errors.email}
            required
          >
            <input
              id={`${uid}-email`}
              className="contact-field"
              type="email"
              autoComplete="email"
              maxLength={254}
              placeholder={t("emailPlaceholder")}
              value={values.email}
              aria-invalid={!!errors.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </Field>
        </div>

        {/* Phone + Country */}
        <div
          className="equal-2col"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          <Field
            id={`${uid}-phone`}
            label={t("phone")}
            error={errors.phone}
            required
          >
            <input
              id={`${uid}-phone`}
              className="contact-field"
              type="tel"
              autoComplete="tel"
              maxLength={40}
              placeholder={t("phonePlaceholder")}
              value={values.phone}
              aria-invalid={!!errors.phone}
              onChange={(e) => update("phone", e.target.value)}
            />
          </Field>
          <Field
            id={`${uid}-country`}
            label={t("country")}
            error={errors.country}
            required
          >
            <select
              id={`${uid}-country`}
              className="contact-field"
              autoComplete="country-name"
              value={values.country}
              aria-invalid={!!errors.country}
              onChange={(e) => update("country", e.target.value)}
              style={{
                color: values.country
                  ? "var(--color-text)"
                  : "var(--color-text-muted)",
              }}
            >
              <option value="" disabled>
                {t("countryPlaceholder")}
              </option>
              <option value={PRIORITY_COUNTRY}>{PRIORITY_COUNTRY}</option>
              <option value="" disabled>
                ──────────
              </option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Inquiry Type */}
        <Field
          id={`${uid}-inquiryType`}
          label={t("inquiryType")}
          error={errors.inquiryType}
          required
        >
          <select
            id={`${uid}-inquiryType`}
            className="contact-field"
            value={values.inquiryType}
            aria-invalid={!!errors.inquiryType}
            onChange={(e) =>
              update("inquiryType", e.target.value as InquiryType)
            }
            style={{
              color: values.inquiryType
                ? "var(--color-text)"
                : "var(--color-text-muted)",
            }}
          >
            <option value="" disabled>
              {t("inquiryTypePlaceholder")}
            </option>
            {INQUIRY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {t(`options.${opt}`)}
              </option>
            ))}
          </select>
        </Field>

        {/* Message */}
        <Field
          id={`${uid}-message`}
          label={t("message")}
          error={errors.message}
          required
        >
          <textarea
            id={`${uid}-message`}
            className="contact-field"
            rows={5}
            maxLength={5000}
            placeholder={t("messagePlaceholder")}
            value={values.message}
            aria-invalid={!!errors.message}
            onChange={(e) => update("message", e.target.value)}
          />
        </Field>

        {/* Honeypot — visually hidden, off the a11y tree, not tab-reachable. */}
        <div aria-hidden="true" className="contact-hp">
          <label htmlFor={`${uid}-website`}>
            Leave this field empty
            <input
              id={`${uid}-website`}
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>

        {/* Submit + secure note */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            marginTop: 4,
          }}
        >
          <motion.button
            type="submit"
            disabled={busy}
            whileHover={reduced || busy ? undefined : { y: -1 }}
            whileTap={reduced || busy ? undefined : { scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 26 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              background: "var(--brand-orange)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-pill)",
              padding: "12px 24px",
              fontSize: "var(--fs-body-sm)",
              fontWeight: 600,
              cursor: busy ? "wait" : "pointer",
              opacity: busy ? 0.75 : 1,
              boxShadow:
                "0 8px 20px -8px color-mix(in oklab, var(--brand-orange) 70%, transparent)",
            }}
          >
            <Send size={16} strokeWidth={2} />
            {busy ? t("sending") : t("submit")}
          </motion.button>

          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "var(--color-text-subtle)",
              fontSize: "var(--fs-caption)",
            }}
          >
            <ShieldCheck size={14} /> {t("secure")}
          </span>
        </div>

        {serverError && (
          <span role="alert" style={{ ...errStyle, marginTop: 0 }}>
            {serverError}
          </span>
        )}
      </div>

      <style>{`
        .contact-hp {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip: rect(0 0 0 0);
          clip-path: inset(50%);
          white-space: nowrap;
          border: 0;
          padding: 0;
          margin: -1px;
        }
      `}</style>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label htmlFor={id} style={labelStyle}>
        {label}
        {required && (
          <span aria-hidden="true" style={{ color: "var(--brand-orange)" }}>
            *
          </span>
        )}
      </label>
      {children}
      {error && (
        <span role="alert" style={errStyle}>
          {error}
        </span>
      )}
    </div>
  );
}
