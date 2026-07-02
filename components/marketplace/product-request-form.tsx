"use client";

import { useState, type CSSProperties } from "react";
import { useTranslations, useLocale } from "next-intl";
import { CtaButton } from "@/components/ui/cta-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Public "Request a product" sourcing form → POST /api/kart/product-request. */
export function ProductRequestForm() {
  const t = useTranslations("productRequest.form");
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
    const res = await fetch("/api/kart/product-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productName: fd.get("productName"),
        category: (fd.get("category") as string) || undefined,
        brand: (fd.get("brand") as string) || undefined,
        quantity: (fd.get("quantity") as string) || undefined,
        budget: (fd.get("budget") as string) || undefined,
        referenceUrl: (fd.get("referenceUrl") as string) || undefined,
        details: (fd.get("details") as string) || undefined,
        name: fd.get("name"),
        email: fd.get("email"),
        phone: (fd.get("phone") as string) || undefined,
        website: (fd.get("website") as string) || undefined,
        locale,
      }),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok && json?.ok) {
      setRef(json.data.requestNumber);
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
      <Field label={t("productName")}>
        <Input name="productName" required maxLength={200} />
      </Field>
      <div style={twoCol}>
        <Field label={t("category")}>
          <Input name="category" maxLength={120} />
        </Field>
        <Field label={t("brand")}>
          <Input name="brand" maxLength={120} />
        </Field>
      </div>
      <div style={twoCol}>
        <Field label={t("quantity")}>
          <Input name="quantity" type="number" min={1} />
        </Field>
        <Field label={t("budget")}>
          <Input name="budget" maxLength={80} />
        </Field>
      </div>
      <Field label={t("referenceUrl")}>
        <Input name="referenceUrl" type="url" maxLength={512} />
      </Field>
      <Field label={t("details")}>
        <textarea
          name="details"
          rows={4}
          maxLength={5000}
          style={textareaStyle}
        />
      </Field>

      <div style={twoCol}>
        <Field label={t("name")}>
          <Input name="name" required maxLength={120} />
        </Field>
        <Field label={t("email")}>
          <Input name="email" type="email" required />
        </Field>
      </div>
      <Field label={t("phone")}>
        <Input name="phone" maxLength={40} />
      </Field>

      {/* Honeypot — hidden from real users. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        style={{
          position: "absolute",
          left: "-9999px",
          width: 1,
          height: 1,
          opacity: 0,
        }}
      />

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
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-sm)",
  background: "var(--color-surface)",
  width: "100%",
  resize: "vertical",
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
