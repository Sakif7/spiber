"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { CtaButton } from "@/components/ui/cta-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toMinor } from "@/lib/money";
import {
  CREDIT_DOC_TYPES,
  REQUIRED_CREDIT_DOCS,
  type CreditDocType,
} from "@/lib/schemas/credit";

type UploadedDoc = {
  label: CreditDocType;
  key: string;
  filename: string;
  size?: number;
  mime?: string;
};

/**
 * Credit-facility application. Documents upload on select to PRIVATE storage
 * (the form only ever holds the returned storage key — never a public URL),
 * mirroring the seller KYC form.
 */
export function CreditApplyForm({
  initial,
}: {
  initial?: { contactName?: string; email?: string };
}) {
  const t = useTranslations("credit.form");
  const td = useTranslations("credit.docs");
  const locale = useLocale();

  const [organization, setOrganization] = useState("");
  const [organizationType, setOrganizationType] = useState("");
  const [contactName, setContactName] = useState(initial?.contactName ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [tradeLicenseNo, setTradeLicenseNo] = useState("");
  const [tinNumber, setTinNumber] = useState("");
  const [binNumber, setBinNumber] = useState("");
  const [volume, setVolume] = useState("");
  const [description, setDescription] = useState("");
  const [docs, setDocs] = useState<Partial<Record<CreditDocType, UploadedDoc>>>(
    {},
  );
  const [uploading, setUploading] = useState<CreditDocType | null>(null);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function upload(label: CreditDocType, file: File) {
    setUploading(label);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/credit/apply/uploads", {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error?.code ?? t("error"));
        return;
      }
      setDocs((d) => ({ ...d, [label]: { label, ...json.data } }));
    } finally {
      setUploading(null);
    }
  }

  async function submit() {
    setError(null);
    const documents = Object.values(docs).filter(Boolean) as UploadedDoc[];
    // Match the server rules so the buyer isn't bounced by a 400.
    if (
      !REQUIRED_CREDIT_DOCS.every((r) => documents.some((d) => d.label === r))
    ) {
      setError(t("missingDocument"));
      return;
    }
    if (!terms) {
      setError(t("termsRequired"));
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/credit/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization,
          organizationType: organizationType || undefined,
          contactName,
          email,
          phone,
          address: address || undefined,
          tradeLicenseNo: tradeLicenseNo || undefined,
          tinNumber: tinNumber || undefined,
          binNumber: binNumber || undefined,
          expectedMonthlyVolumeMinor: volume.trim()
            ? toMinor(Number(volume) || 0)
            : undefined,
          description,
          documents,
          termsAccepted: true,
          locale,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const code = json?.error?.code;
        setError(
          code === "already_enlisted"
            ? t("alreadyEnlisted")
            : code === "already_applied"
              ? t("alreadyApplied")
              : t("error"),
        );
        return;
      }
      setDone(json.data.applicationNumber as string);
    } catch {
      setError(t("error"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div style={panel}>
        <strong style={{ fontSize: "var(--fs-h5)" }}>
          {t("successTitle")}
        </strong>
        <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
          {t("successBody")}
        </p>
        <p style={{ margin: 0, fontFamily: "var(--font-mono)" }}>{done}</p>
      </div>
    );
  }

  return (
    <div style={panel}>
      <strong style={{ fontSize: "var(--fs-h5)" }}>{t("title")}</strong>

      <div style={row}>
        <Field label={t("organization")}>
          <Input
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            maxLength={160}
          />
        </Field>
        <Field label={t("organizationType")}>
          <Input
            value={organizationType}
            onChange={(e) => setOrganizationType(e.target.value)}
            placeholder={t("organizationTypePlaceholder")}
            maxLength={120}
          />
        </Field>
      </div>

      <div style={row}>
        <Field label={t("contactName")}>
          <Input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            maxLength={120}
          />
        </Field>
        <Field label={t("phone")}>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={40}
          />
        </Field>
      </div>

      <div style={row}>
        <Field label={t("email")}>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={200}
          />
        </Field>
        <Field label={t("address")}>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={300}
          />
        </Field>
      </div>

      <div style={row}>
        <Field label={t("tradeLicenseNo")}>
          <Input
            value={tradeLicenseNo}
            onChange={(e) => setTradeLicenseNo(e.target.value)}
            maxLength={80}
          />
        </Field>
        <Field label={t("expectedVolume")}>
          <Input
            type="number"
            min={0}
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
          />
        </Field>
      </div>

      <div style={row}>
        <Field label={t("tinNumber")}>
          <Input
            value={tinNumber}
            onChange={(e) => setTinNumber(e.target.value)}
            maxLength={80}
          />
        </Field>
        <Field label={t("binNumber")}>
          <Input
            value={binNumber}
            onChange={(e) => setBinNumber(e.target.value)}
            maxLength={80}
          />
        </Field>
      </div>

      <Field label={t("description")}>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={5000}
          style={textarea}
        />
      </Field>

      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <Label>{t("documents")}</Label>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "var(--fs-caption)",
              color: "var(--color-text-muted)",
            }}
          >
            {t("documentsHint")}
          </p>
        </div>
        {CREDIT_DOC_TYPES.map((label) => {
          const uploaded = docs[label];
          const required = REQUIRED_CREDIT_DOCS.includes(label);
          return (
            <div key={label} style={docRow}>
              <span>
                {td(label)}{" "}
                <span
                  style={{
                    fontSize: "var(--fs-caption)",
                    color: required
                      ? "var(--color-brand-deep)"
                      : "var(--color-text-muted)",
                  }}
                >
                  ({required ? t("required") : t("optional")})
                </span>
                {uploaded ? (
                  <span
                    style={{
                      display: "block",
                      fontSize: "var(--fs-caption)",
                      color: "var(--color-success)",
                    }}
                  >
                    ✓ {uploaded.filename}
                  </span>
                ) : null}
              </span>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label style={uploadBtn}>
                  {uploading === label
                    ? "…"
                    : uploaded
                      ? t("replace")
                      : t("upload")}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void upload(label, f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {uploaded ? (
                  <button
                    type="button"
                    onClick={() =>
                      setDocs((d) => {
                        const next = { ...d };
                        delete next[label];
                        return next;
                      })
                    }
                    style={linkBtn}
                  >
                    {t("remove")}
                  </button>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>

      <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <input
          type="checkbox"
          checked={terms}
          onChange={(e) => setTerms(e.target.checked)}
        />
        <span style={{ fontSize: "var(--fs-body-sm)" }}>{t("terms")}</span>
      </label>

      {error ? (
        <p role="alert" style={{ margin: 0, color: "var(--color-error)" }}>
          {error}
        </p>
      ) : null}

      <CtaButton
        onClick={() => !busy && submit()}
        style={{ opacity: busy ? 0.6 : 1 }}
      >
        {busy ? t("submitting") : t("submit")}
      </CtaButton>
    </div>
  );
}

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

const panel: React.CSSProperties = {
  display: "grid",
  gap: "var(--s-4)",
  padding: "var(--s-5)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-lg)",
  background: "var(--color-surface)",
};

const row: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "var(--s-4)",
};

const textarea: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid var(--color-border-field)",
  borderRadius: "var(--r-sm)",
  font: "inherit",
  background: "var(--color-surface)",
  resize: "vertical",
};

const docRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "var(--s-3)",
  padding: "10px 12px",
  border: "1px solid var(--color-hairline)",
  borderRadius: "var(--r-sm)",
};

const uploadBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 14px",
  borderRadius: "var(--r-pill)",
  border: "1px solid var(--color-border-field)",
  fontSize: "var(--fs-small)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const linkBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  color: "var(--color-text-muted)",
  fontSize: "var(--fs-small)",
  textDecoration: "underline",
  cursor: "pointer",
};
