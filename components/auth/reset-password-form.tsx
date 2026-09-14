"use client";

import { useState, type CSSProperties } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Check, Eye, EyeOff } from "lucide-react";
import { resetFormSchema, type ResetFormValues } from "@/lib/schemas/user";
import { PASSWORD_RULES, passwordChecks } from "@/lib/auth/password-rules";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CtaButton } from "@/components/ui/cta-button";
import { AuthLinkButton, FieldError } from "./form-bits";

/**
 * Choose a new password — from a "forgot password" email or an employee's
 * invite (same token route; the words differ). Lives inside the sign-in
 * modal: on success the modal flips to sign-in with the email filled in.
 */
export function ResetPasswordForm({
  token,
  invite = false,
  onDone,
  onForgot,
  onBack,
  submitStyle,
}: {
  token?: string;
  /** An employee invite: "set" rather than "reset". */
  invite?: boolean;
  /** The password is saved; `email` is the account it belongs to. */
  onDone: (email: string | null) => void;
  /** The link was dead — start a fresh "forgot password" request. */
  onForgot: () => void;
  onBack: () => void;
  submitStyle?: CSSProperties;
}) {
  const t = useTranslations("auth.reset");
  const [serverError, setServerError] = useState<
    "invalid" | "rate" | "generic" | null
  >(null);
  const [show, setShow] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting, touchedFields, submitCount },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetFormSchema),
    mode: "onTouched",
    defaultValues: { password: "", confirm: "" },
  });
  const pw = useWatch({ control, name: "password" }) ?? "";
  const checks = passwordChecks(pw);
  const showChecks = pw.length > 0 || touchedFields.password || submitCount > 0;

  if (!token) {
    return (
      <div style={{ display: "grid", gap: "var(--s-4)" }}>
        <p
          role="alert"
          style={{
            margin: 0,
            color: "var(--color-error)",
            fontSize: "var(--fs-small)",
          }}
        >
          {t("missingToken")}
        </p>
        <AuthLinkButton onClick={onForgot} strong>
          {t("requestNew")}
        </AuthLinkButton>
        <AuthLinkButton onClick={onBack}>← {t("back")}</AuthLinkButton>
      </div>
    );
  }

  async function onSubmit(values: ResetFormValues) {
    setServerError(null);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: values.password }),
      });
      if (res.status === 429) {
        setServerError("rate");
        return;
      }
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        onDone(typeof json.data?.email === "string" ? json.data.email : null);
        return;
      }
      setServerError(
        json?.error?.code === "invalid_token" ? "invalid" : "generic",
      );
    } catch {
      setServerError("generic");
    }
  }

  const fieldType = show ? "text" : "password";

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      style={{ display: "grid", gap: "var(--s-4)" }}
    >
      <div style={{ display: "grid", gap: 6 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Label htmlFor="reset-password">{t("password")}</Label>
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-pressed={show}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "none",
              border: "none",
              padding: 0,
              font: "inherit",
              fontSize: "var(--fs-caption)",
              color: "var(--color-text-muted)",
              cursor: "pointer",
            }}
          >
            {show ? (
              <EyeOff size={14} aria-hidden />
            ) : (
              <Eye size={14} aria-hidden />
            )}
            {show ? t("hide") : t("show")}
          </button>
        </div>
        <Input
          id="reset-password"
          type={fieldType}
          autoComplete="new-password"
          {...register("password")}
          aria-invalid={!!errors.password}
          aria-describedby="reset-password-rules"
        />
        {/* The rules, ticking as they type — the same rules the server holds. */}
        <ul
          id="reset-password-rules"
          aria-label={t("rulesLabel")}
          style={{
            listStyle: "none",
            margin: "2px 0 0",
            padding: 0,
            display: "grid",
            gap: 3,
            fontSize: "var(--fs-caption)",
          }}
        >
          {PASSWORD_RULES.map((rule) => {
            const ok = checks[rule];
            const failed = showChecks && !ok;
            return (
              <li
                key={rule}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: ok
                    ? "var(--color-success)"
                    : failed && submitCount > 0
                      ? "var(--color-error)"
                      : "var(--color-text-muted)",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    border: `1.5px solid ${ok ? "var(--color-success)" : "currentColor"}`,
                    background: ok ? "var(--color-success)" : "transparent",
                    color: "white",
                    flexShrink: 0,
                  }}
                >
                  {ok && <Check size={10} strokeWidth={3} />}
                </span>
                <span>
                  {t(`rule_${rule}`)}
                  <span className="sr-only">
                    {" "}
                    — {ok ? t("ruleMet") : t("ruleNotMet")}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <Label htmlFor="reset-confirm">{t("confirm")}</Label>
        <Input
          id="reset-confirm"
          type={fieldType}
          autoComplete="new-password"
          {...register("confirm")}
          aria-invalid={!!errors.confirm}
          aria-describedby={errors.confirm ? "reset-confirm-error" : undefined}
        />
        <FieldError id="reset-confirm-error">
          {errors.confirm?.message}
        </FieldError>
      </div>

      {serverError && (
        <div
          role="alert"
          style={{
            display: "grid",
            gap: 6,
            color: "var(--color-error)",
            fontSize: "var(--fs-small)",
          }}
        >
          <span>
            {serverError === "invalid"
              ? invite
                ? t("inviteExpired")
                : t("error")
              : serverError === "rate"
                ? t("errorRateLimited")
                : t("errorGeneric")}
          </span>
          {serverError === "invalid" && !invite && (
            <AuthLinkButton onClick={onForgot} strong>
              {t("requestNew")}
            </AuthLinkButton>
          )}
        </div>
      )}

      <CtaButton type="submit" style={{ width: "100%", ...submitStyle }}>
        {isSubmitting
          ? t("submitting")
          : invite
            ? t("inviteSubmit")
            : t("submit")}
      </CtaButton>
      <AuthLinkButton onClick={onBack}>← {t("back")}</AuthLinkButton>
    </form>
  );
}
