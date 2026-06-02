"use client";

import { useState, type CSSProperties } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";
import { MailCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  registerFormSchema,
  type RegisterFormValues,
} from "@/lib/schemas/user";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CtaButton } from "@/components/ui/cta-button";

export function RegisterForm({
  onSignIn,
  submitStyle,
}: {
  onSignIn?: () => void;
  submitStyle?: CSSProperties;
}) {
  const t = useTranslations("auth.register");
  const locale = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  async function onSubmit(values: RegisterFormValues) {
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, locale }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setSentTo(values.email);
        return;
      }
      setError(
        json?.error?.code === "email_taken"
          ? t("errorTaken")
          : t("errorGeneric"),
      );
    } catch {
      setError(t("errorGeneric"));
    }
  }

  if (sentTo) {
    return (
      <div style={{ display: "grid", gap: "var(--s-4)", textAlign: "center" }}>
        <span
          aria-hidden
          style={{
            justifySelf: "center",
            display: "grid",
            placeItems: "center",
            width: 52,
            height: 52,
            borderRadius: "var(--r-pill)",
            background: "var(--color-brand-soft)",
            color: "var(--color-brand-deep)",
          }}
        >
          <MailCheck size={26} strokeWidth={2} />
        </span>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--fs-h4)",
            color: "var(--color-text-strong)",
          }}
        >
          {t("checkEmailTitle")}
        </h1>
        <p
          style={{
            margin: 0,
            color: "var(--color-text-muted)",
            fontSize: "var(--fs-body-sm)",
            lineHeight: 1.6,
          }}
        >
          {t("checkEmailBody", { email: sentTo })}
        </p>
        {onSignIn ? (
          <button
            type="button"
            onClick={onSignIn}
            style={{
              marginTop: "var(--s-2)",
              background: "none",
              border: "none",
              font: "inherit",
              cursor: "pointer",
              color: "var(--color-brand-deep)",
              fontWeight: 500,
              fontSize: "var(--fs-body-sm)",
            }}
          >
            {t("signIn")}
          </button>
        ) : (
          <Link
            href="/"
            style={{
              marginTop: "var(--s-2)",
              color: "var(--color-brand-deep)",
              fontWeight: 500,
              fontSize: "var(--fs-body-sm)",
            }}
          >
            {t("signIn")}
          </Link>
        )}
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
        <Label htmlFor="name">{t("name")}</Label>
        <Input
          id="name"
          autoComplete="name"
          {...register("name")}
          aria-invalid={!!errors.name}
        />
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          {...register("email")}
          aria-invalid={!!errors.email}
        />
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register("password")}
          aria-invalid={!!errors.password}
        />
        <span
          style={{
            fontSize: "var(--fs-caption)",
            color: "var(--color-text-subtle)",
          }}
        >
          {t("passwordHint")}
        </span>
      </div>
      {error && (
        <p style={{ color: "var(--color-error)", fontSize: "var(--fs-small)" }}>
          {error}
        </p>
      )}
      <CtaButton type="submit" style={{ width: "100%", ...submitStyle }}>
        {isSubmitting ? t("submitting") : t("submit")}
      </CtaButton>
    </form>
  );
}
