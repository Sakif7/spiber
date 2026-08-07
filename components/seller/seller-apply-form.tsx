"use client";

import { useState, type CSSProperties } from "react";
import { useTranslations, useLocale } from "next-intl";
import { CtaButton } from "@/components/ui/cta-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Public "Become a seller" application form → POST /api/seller/apply. */
export function SellerApplyForm() {
  const t = useTranslations("becomeSeller.form");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy(true);
    setError(null);

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
        phone: (fd.get("phone") as string) || undefined,
        website: (fd.get("website") as string) || undefined,
        address: (fd.get("address") as string) || undefined,
        categories: (fd.get("categories") as string) || undefined,
        description: fd.get("description"),
        bankDetails: hasBank ? bank : undefined,
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
          <Input name="contactName" required maxLength={120} />
        </Field>
      </div>

      <div style={twoCol}>
        <Field label={t("email")}>
          <Input name="email" type="email" required maxLength={200} />
        </Field>
        <Field label={t("phone")}>
          <Input name="phone" maxLength={40} />
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

      <fieldset style={fieldsetStyle}>
        <legend
          style={{
            fontSize: "var(--fs-caption)",
            fontWeight: 600,
            color: "var(--color-text-strong)",
            padding: "0 6px",
          }}
        >
          {t("bank")}
        </legend>
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
