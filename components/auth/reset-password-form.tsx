"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { resetFormSchema, type ResetFormValues } from "@/lib/schemas/user";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CtaButton } from "@/components/ui/cta-button";

export function ResetPasswordForm({ token }: { token?: string }) {
  const t = useTranslations("auth.reset");
  const [state, setState] = useState<"idle" | "success" | "error">("idle");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetFormSchema),
    defaultValues: { password: "" },
  });

  if (!token) {
    return (
      <p style={{ color: "var(--color-error)", fontSize: "var(--fs-small)" }}>
        {t("missingToken")}
      </p>
    );
  }

  if (state === "success") {
    return (
      <div style={{ display: "grid", gap: "var(--s-4)" }}>
        <p style={{ color: "var(--color-success)" }}>{t("success")}</p>
        <CtaButton href="/login">{t("submit")}</CtaButton>
      </div>
    );
  }

  async function onSubmit(values: ResetFormValues) {
    setState("idle");
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: values.password }),
      });
      const json = await res.json();
      setState(res.ok && json.ok ? "success" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      style={{ display: "grid", gap: "var(--s-4)" }}
    >
      <div style={{ display: "grid", gap: 6 }}>
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register("password")}
          aria-invalid={!!errors.password}
        />
        {errors.password && (
          <span
            style={{ color: "var(--color-error)", fontSize: "var(--fs-small)" }}
          >
            {errors.password.message}
          </span>
        )}
      </div>
      {state === "error" && (
        <p style={{ color: "var(--color-error)", fontSize: "var(--fs-small)" }}>
          {t("error")}
        </p>
      )}
      <CtaButton type="submit" style={{ width: "100%" }}>
        {isSubmitting ? t("submitting") : t("submit")}
      </CtaButton>
      <Link
        href="/login"
        style={{
          fontSize: "var(--fs-small)",
          color: "var(--color-text-muted)",
          textAlign: "center",
        }}
      >
        ← {t("submit")}
      </Link>
    </form>
  );
}
