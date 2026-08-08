"use client";

import { useState, type CSSProperties } from "react";
import { useTranslations, useLocale } from "next-intl";
import { FileText, X } from "lucide-react";
import { CtaButton } from "@/components/ui/cta-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DocType =
  | "trade_license"
  | "national_id"
  | "tin_certificate"
  | "bank_statement";

type UploadedDoc = {
  label: DocType;
  key: string;
  filename: string;
  size?: number;
  mime?: string;
};

const DOC_TYPES: { label: DocType; required: boolean; i18nKey: string }[] = [
  { label: "trade_license", required: true, i18nKey: "docTradeLicense" },
  { label: "national_id", required: true, i18nKey: "docNationalId" },
  { label: "tin_certificate", required: false, i18nKey: "docTin" },
  { label: "bank_statement", required: false, i18nKey: "docBankStatement" },
];

/** Public "Become a seller" application form → POST /api/seller/apply.
 * Collects business + bank details AND the KYC documents admins verify. */
export function SellerApplyForm({
  defaultName = "",
  defaultEmail = "",
}: {
  /** Prefilled from the logged-in session. */
  defaultName?: string;
  defaultEmail?: string;
}) {
  const t = useTranslations("becomeSeller.form");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [docs, setDocs] = useState<Partial<Record<DocType, UploadedDoc>>>({});
  const [docBusy, setDocBusy] = useState<DocType | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [terms, setTerms] = useState(false);

  async function uploadDoc(label: DocType, file: File) {
    setDocBusy(label);
    setDocError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/seller/apply/uploads", {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setDocs((d) => ({
          ...d,
          [label]: {
            label,
            key: json.data.key as string,
            filename: (json.data.filename as string) || file.name,
            size: json.data.size as number | undefined,
            mime: json.data.mime as string | undefined,
          },
        }));
      } else {
        setDocError(t("docUploadError"));
      }
    } catch {
      setDocError(t("docUploadError"));
    } finally {
      setDocBusy(null);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setError(null);

    const missing = DOC_TYPES.filter((d) => d.required && !docs[d.label]);
    if (missing.length > 0) {
      setError(t("docsRequiredError"));
      return;
    }
    if (!terms) {
      setError(t("termsRequiredError"));
      return;
    }

    setBusy(true);
    const bank = {
      accountName: (fd.get("accountName") as string)?.trim() || undefined,
      bankName: (fd.get("bankName") as string)?.trim() || undefined,
      accountNumber: (fd.get("accountNumber") as string)?.trim() || undefined,
      branch: (fd.get("branch") as string)?.trim() || undefined,
      routingNumber: (fd.get("routingNumber") as string)?.trim() || undefined,
      mobileWallet: (fd.get("mobileWallet") as string)?.trim() || undefined,
    };
    const hasBank = Object.values(bank).some((v) => v);

    const res = await fetch("/api/seller/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName: fd.get("businessName"),
        contactName: fd.get("contactName"),
        email: fd.get("email"),
        phone: fd.get("phone"),
        website: (fd.get("website") as string) || undefined,
        address: (fd.get("address") as string) || undefined,
        categories: (fd.get("categories") as string) || undefined,
        description: fd.get("description"),
        bankDetails: hasBank ? bank : undefined,
        documents: Object.values(docs),
        termsAccepted: true,
        locale,
      }),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok && json?.ok) {
      setRef(json.data.applicationNumber);
      setDone(true);
      form.reset();
    } else {
      setError(t("error"));
    }
  }

  if (done) {
    return (
      <div
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: "var(--r-lg)",
          background: "var(--color-surface)",
          padding: "var(--s-6)",
          display: "grid",
          gap: 8,
        }}
      >
        <h3
          style={{
            color: "var(--color-text-strong)",
            fontSize: "var(--fs-h5)",
          }}
        >
          {t("successTitle")}
        </h3>
        <p style={{ color: "var(--color-text-muted)" }}>{t("successNote")}</p>
        {ref && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--fs-caption)",
            }}
          >
            {ref}
          </span>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: "var(--s-4)" }}>
      <h3
        style={{ color: "var(--color-text-strong)", fontSize: "var(--fs-h4)" }}
      >
        {t("title")}
      </h3>

      <div style={twoCol}>
        <Field label={t("businessName")}>
          <Input name="businessName" required maxLength={200} />
        </Field>
        <Field label={t("contactName")}>
          <Input
            name="contactName"
            required
            maxLength={120}
            defaultValue={defaultName}
          />
        </Field>
      </div>

      <div style={twoCol}>
        <Field label={t("email")}>
          <Input
            name="email"
            type="email"
            required
            maxLength={200}
            defaultValue={defaultEmail}
          />
        </Field>
        <Field label={t("phone")}>
          <Input name="phone" required minLength={6} maxLength={40} />
        </Field>
      </div>

      <div style={twoCol}>
        <Field label={t("website")}>
          <Input name="website" type="url" maxLength={512} />
        </Field>
        <Field label={t("categories")}>
          <Input name="categories" maxLength={200} />
        </Field>
      </div>

      <Field label={t("address")}>
        <Input name="address" maxLength={300} />
      </Field>

      <Field label={t("description")}>
        <textarea
          name="description"
          rows={4}
          required
          maxLength={2000}
          style={textareaStyle}
        />
      </Field>

      {/* KYC documents — verified by our team before approval. */}
      <fieldset style={fieldsetStyle}>
        <legend style={legendStyle}>{t("documentsTitle")}</legend>
        <p
          style={{
            margin: 0,
            fontSize: "var(--fs-small)",
            color: "var(--color-text-muted)",
          }}
        >
          {t("documentsHint")}
        </p>
        <div style={{ display: "grid", gap: "var(--s-3)" }}>
          {DOC_TYPES.map((d) => {
            const uploaded = docs[d.label];
            return (
              <div key={d.label} style={docRow}>
                <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: "var(--fs-body-sm)",
                      fontWeight: 600,
                      color: "var(--color-text-strong)",
                    }}
                  >
                    {t(d.i18nKey)}
                    {d.required ? (
                      <span style={{ color: "var(--color-error)" }}> *</span>
                    ) : (
                      <span
                        style={{
                          color: "var(--color-text-subtle)",
                          fontWeight: 400,
                        }}
                      >
                        {" "}
                        · {t("optional")}
                      </span>
                    )}
                  </span>
                  {uploaded && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: "var(--fs-caption)",
                        color: "var(--color-brand-deep)",
                        minWidth: 0,
                      }}
                    >
                      <FileText size={13} aria-hidden />
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {uploaded.filename}
                      </span>
                    </span>
                  )}
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    gap: 8,
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <label style={docBtn}>
                    {docBusy === d.label
                      ? t("uploading")
                      : uploaded
                        ? t("replace")
                        : t("upload")}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      hidden
                      disabled={docBusy !== null}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadDoc(d.label, f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {uploaded && (
                    <button
                      type="button"
                      aria-label={t("remove")}
                      onClick={() =>
                        setDocs((prev) => {
                          const next = { ...prev };
                          delete next[d.label];
                          return next;
                        })
                      }
                      style={docRemoveBtn}
                    >
                      <X size={14} aria-hidden />
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
        {docError && (
          <span
            style={{ color: "var(--color-error)", fontSize: "var(--fs-sm)" }}
          >
            {docError}
          </span>
        )}
      </fieldset>

      <fieldset style={fieldsetStyle}>
        <legend style={legendStyle}>{t("bank")}</legend>
        <div style={{ display: "grid", gap: "var(--s-4)" }}>
          <div style={twoCol}>
            <Field label={t("accountName")}>
              <Input name="accountName" maxLength={120} />
            </Field>
            <Field label={t("bankName")}>
              <Input name="bankName" maxLength={120} />
            </Field>
          </div>
          <div style={twoCol}>
            <Field label={t("accountNumber")}>
              <Input name="accountNumber" maxLength={60} />
            </Field>
            <Field label={t("branch")}>
              <Input name="branch" maxLength={120} />
            </Field>
          </div>
          <div style={twoCol}>
            <Field label={t("routingNumber")}>
              <Input name="routingNumber" maxLength={40} />
            </Field>
            <Field label={t("mobileWallet")}>
              <Input name="mobileWallet" maxLength={40} />
            </Field>
          </div>
        </div>
      </fieldset>

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          cursor: "pointer",
          fontSize: "var(--fs-body-sm)",
          color: "var(--color-text)",
        }}
      >
        <input
          type="checkbox"
          checked={terms}
          onChange={(e) => setTerms(e.target.checked)}
          style={{ marginTop: 3 }}
        />
        <span>{t("terms")}</span>
      </label>

      {error && (
        <span style={{ color: "var(--color-error)", fontSize: "var(--fs-sm)" }}>
          {error}
        </span>
      )}
      <div>
        <CtaButton type="submit" style={{ opacity: busy ? 0.7 : 1 }}>
          {busy ? t("submitting") : t("submit")}
        </CtaButton>
      </div>
    </form>
  );
}

const twoCol: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "var(--s-4)",
};

const textareaStyle: CSSProperties = {
  font: "inherit",
  padding: "8px 10px",
  border: "1px solid var(--color-border-field)",
  borderRadius: "var(--r-sm)",
  background: "var(--color-surface)",
  width: "100%",
  resize: "vertical",
};

const fieldsetStyle: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-md)",
  padding: "var(--s-4)",
  display: "grid",
  gap: "var(--s-4)",
};

const legendStyle: CSSProperties = {
  fontSize: "var(--fs-caption)",
  fontWeight: 600,
  color: "var(--color-text-strong)",
  padding: "0 6px",
};

const docRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--s-4)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-sm)",
  padding: "10px 12px",
  background: "var(--color-surface)",
};

const docBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "7px 14px",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-brand-deep)",
  fontWeight: 600,
  fontSize: "var(--fs-sm)",
  cursor: "pointer",
};

const docRemoveBtn: CSSProperties = {
  display: "inline-grid",
  placeItems: "center",
  width: 28,
  height: 28,
  borderRadius: 999,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-error)",
  cursor: "pointer",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
