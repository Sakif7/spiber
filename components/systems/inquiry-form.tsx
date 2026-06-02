"use client";

import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { CtaButton } from "@/components/ui/cta-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LinkedEntity = { kind: "software" | "package" | "service"; id: string };

export function InquiryForm({
  linkedEntity,
  subject,
}: {
  linkedEntity?: LinkedEntity;
  subject?: string;
}) {
  const t = useTranslations("systems.custom");
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
    const res = await fetch("/api/systems/inquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        division: "systems",
        subject: subject || (fd.get("company") as string) || undefined,
        name: fd.get("name"),
        email: fd.get("email"),
        phone: (fd.get("phone") as string) || undefined,
        company: (fd.get("company") as string) || undefined,
        budgetRange: (fd.get("budget") as string) || undefined,
        message: fd.get("message"),
        linkedEntity,
      }),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok && json?.ok) {
      setRef(json.data.inquiryNumber);
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
      <div style={twoCol}>
        <Field label={t("name")}>
          <Input name="name" required maxLength={120} />
        </Field>
        <Field label={t("email")}>
          <Input name="email" type="email" required />
        </Field>
      </div>
      <div style={twoCol}>
        <Field label={t("phone")}>
          <Input name="phone" maxLength={40} />
        </Field>
        <Field label={t("company")}>
          <Input name="company" maxLength={160} />
        </Field>
      </div>
      <Field label={t("budget")}>
        <Input name="budget" maxLength={60} />
      </Field>
      <Field label={t("message")}>
        <textarea
          name="message"
          required
          rows={5}
          maxLength={5000}
          style={{
            font: "inherit",
            padding: "8px 10px",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--r-sm)",
            background: "var(--color-surface)",
            width: "100%",
            resize: "vertical",
          }}
        />
      </Field>
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
