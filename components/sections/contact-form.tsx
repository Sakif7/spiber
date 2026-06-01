"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { contactFormSchema, type ContactFormValues } from "@/lib/schemas/forms";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CtaButton } from "@/components/ui/cta-button";

type Status = "idle" | "success" | "error";

export function ContactForm() {
  const t = useTranslations("pages.contact");
  const [status, setStatus] = useState<Status>("idle");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: { name: "", email: "", org: "", phone: "", message: "" },
  });

  async function onSubmit(values: ContactFormValues) {
    setStatus("idle");
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setStatus("success");
        reset();
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  const errStyle = { color: "var(--color-error)", fontSize: "var(--fs-small)" };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      style={{ display: "grid", gap: "var(--s-4)", maxWidth: 560 }}
    >
      <div style={{ display: "grid", gap: 6 }}>
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" {...register("name")} aria-invalid={!!errors.name} />
        {errors.name && <span style={errStyle}>{t("name")}</span>}
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email"
          type="email"
          {...register("email")}
          aria-invalid={!!errors.email}
        />
        {errors.email && <span style={errStyle}>{t("email")}</span>}
      </div>

      <div
        style={{
          display: "grid",
          gap: "var(--s-4)",
          gridTemplateColumns: "1fr 1fr",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <Label htmlFor="org">{t("org")}</Label>
          <Input id="org" {...register("org")} />
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <Label htmlFor="phone">{t("phone")}</Label>
          <Input id="phone" {...register("phone")} />
        </div>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <Label htmlFor="message">{t("message")}</Label>
        <textarea
          id="message"
          rows={5}
          {...register("message")}
          aria-invalid={!!errors.message}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
            background: "transparent",
            font: "inherit",
            color: "var(--color-text)",
            resize: "vertical",
          }}
        />
        {errors.message && <span style={errStyle}>{t("message")}</span>}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-4)" }}>
        <CtaButton type="submit">
          {isSubmitting ? t("sending") : t("submit")}
        </CtaButton>
        {status === "success" && (
          <span
            style={{
              color: "var(--color-success)",
              fontSize: "var(--fs-small)",
            }}
          >
            {t("success")}
          </span>
        )}
        {status === "error" && <span style={errStyle}>{t("error")}</span>}
      </div>
    </form>
  );
}
