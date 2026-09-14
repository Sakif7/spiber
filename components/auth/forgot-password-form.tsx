"use client";

import { useState, type CSSProperties } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { MailCheck } from "lucide-react";
import { forgotFormSchema, type ForgotFormValues } from "@/lib/schemas/user";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CtaButton } from "@/components/ui/cta-button";
import { AuthLinkButton, FieldError } from "./form-bits";

/**
 * "Forgot password": one email field. The server always answers ok (it never
 * says whether an address is registered), so the form always shows the
 * "check your inbox" state after a submit.
 */
export function ForgotPasswordForm({
  onBack,
  defaultEmail,
  submitStyle,
}: {
  onBack: () => void;
  defaultEmail?: string;
  submitStyle?: CSSProperties;
}) {
  const t = useTranslations("auth.forgot");
  const locale = useLocale();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotFormSchema),
    defaultValues: { email: defaultEmail ?? "" },
  });

  async function onSubmit(values: ForgotFormValues) {
    setError(null);
    try {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email, locale }),
      });
      if (res.status === 429) {
        setError(t("errorRateLimited"));
        return;
      }
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(t("errorGeneric"));
        return;
      }
      setSentTo(values.email.trim());
    } catch {
      setError(t("errorGeneric"));
    }
  }

  if (sentTo) {
    return (
      <div style={{ display: "grid", gap: "var(--s-4)" }}>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
            padding: "12px 14px",
            borderRadius: "var(--r-md)",
            background:
              "color-mix(in oklab, var(--color-success) 10%, var(--color-surface))",
            color: "var(--color-text)",
            fontSize: "var(--fs-body-sm)",
            lineHeight: 1.5,
          }}
        >
          <MailCheck
            size={20}
            aria-hidden
            style={{ color: "var(--color-success)", flexShrink: 0 }}
          />
          <span>
            {t.rich("sent", {
              email: () => <strong>{sentTo}</strong>,
            })}
          </span>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: "var(--fs-small)",
            color: "var(--color-text-muted)",
          }}
        >
          {t("sentHint")}
        </p>
        <AuthLinkButton onClick={onBack}>← {t("back")}</AuthLinkButton>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      style={{ display: "grid", gap: "var(--s-4)" }}
    >
      <div style={{ display: "grid", gap: 6 }}>
        <Label htmlFor="forgot-email">{t("email")}</Label>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          {...register("email")}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "forgot-email-error" : undefined}
        />
        <FieldError id="forgot-email-error">{errors.email?.message}</FieldError>
      </div>
      {error && (
        <p
          role="alert"
          style={{
            margin: 0,
            color: "var(--color-error)",
            fontSize: "var(--fs-small)",
          }}
        >
          {error}
        </p>
      )}
      <CtaButton type="submit" style={{ width: "100%", ...submitStyle }}>
        {isSubmitting ? t("submitting") : t("submit")}
      </CtaButton>
      <AuthLinkButton onClick={onBack}>← {t("back")}</AuthLinkButton>
    </form>
  );
}
