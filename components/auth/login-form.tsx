"use client";

import { useState, type CSSProperties } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { loginFormSchema, type LoginFormValues } from "@/lib/schemas/user";
import { postLoginDestination } from "@/lib/auth/post-login";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CtaButton } from "@/components/ui/cta-button";

// Re-exported for existing importers; the logic lives in the (unit-tested,
// framework-free) lib module so both entry points share one implementation.
export { stripLocale, type AuthedUser } from "@/lib/auth/post-login";
import type { AuthedUser } from "@/lib/auth/post-login";

export function LoginForm({
  next,
  verified,
  verifyError,
  onSuccess,
  onForgot,
  submitStyle,
}: {
  next?: string;
  verified?: boolean;
  /** The verify-email link the user clicked was invalid/expired. */
  verifyError?: boolean;
  /** When provided (modal), called on success instead of navigating. */
  onSuccess?: (user: AuthedUser) => void;
  /** When provided (modal), intercepts the "forgot password" link. */
  onForgot?: () => void;
  /** Optional style override for the submit button (e.g. modal accent). */
  submitStyle?: CSSProperties;
}) {
  const t = useTranslations("auth.login");
  const locale = useLocale();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Offer "resend verification" after an unverified-login attempt or a dead
  // verification link.
  const [showResend, setShowResend] = useState(Boolean(verifyError));
  const [resendState, setResendState] = useState<
    "idle" | "sending" | "sent" | "needEmail"
  >("idle");

  const {
    register,
    handleSubmit,
    getValues,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: "", password: "" },
  });

  async function resendVerification() {
    const email = getValues("email").trim();
    if (!email) {
      setResendState("needEmail");
      setFocus("email");
      return;
    }
    setResendState("sending");
    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
      setResendState("sent");
    } catch {
      setResendState("idle");
    }
  }

  async function onSubmit(values: LoginFormValues) {
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        const user: AuthedUser = json.data?.user ?? {};
        if (onSuccess) {
          onSuccess(user);
          return;
        }
        // Standalone page: ?next= wins, else role-routed; a plain customer goes
        // home (there's nowhere else for a dedicated /login page to land).
        router.replace(postLoginDestination(user, next) ?? "/");
        router.refresh();
        return;
      }
      const code = json?.error?.code;
      if (code === "invalid_credentials") setError(t("errorInvalid"));
      else if (code === "email_not_verified") {
        setError(t("errorUnverified"));
        setShowResend(true);
      } else setError(t("errorGeneric"));
    } catch {
      setError(t("errorGeneric"));
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      style={{ display: "grid", gap: "var(--s-4)" }}
    >
      {verified && (
        <p
          style={{ color: "var(--color-success)", fontSize: "var(--fs-small)" }}
        >
          {t("verifiedNotice")}
        </p>
      )}
      {verifyError && !error && (
        <p style={{ color: "var(--color-error)", fontSize: "var(--fs-small)" }}>
          {t("errorVerifyLink")}
        </p>
      )}
      <div style={{ display: "grid", gap: 6 }}>
        <Label htmlFor="login-email">{t("email")}</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          {...register("email")}
          aria-invalid={!!errors.email}
        />
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <Label htmlFor="login-password">{t("password")}</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
          aria-invalid={!!errors.password}
        />
      </div>
      {error && (
        <p style={{ color: "var(--color-error)", fontSize: "var(--fs-small)" }}>
          {error}
        </p>
      )}
      {showResend &&
        (resendState === "sent" ? (
          <p
            style={{
              color: "var(--color-success)",
              fontSize: "var(--fs-small)",
            }}
          >
            {t("resendSent")}
          </p>
        ) : (
          <div style={{ display: "grid", gap: 4 }}>
            <button
              type="button"
              onClick={resendVerification}
              disabled={resendState === "sending"}
              style={{
                background: "none",
                border: "none",
                font: "inherit",
                cursor: "pointer",
                fontSize: "var(--fs-small)",
                fontWeight: 600,
                color: "var(--color-brand-deep)",
                textAlign: "left",
                padding: 0,
              }}
            >
              {resendState === "sending" ? t("resendSending") : t("resend")}
            </button>
            {resendState === "needEmail" && (
              <span
                style={{
                  color: "var(--color-error)",
                  fontSize: "var(--fs-caption)",
                }}
              >
                {t("resendNeedEmail")}
              </span>
            )}
          </div>
        ))}
      <CtaButton type="submit" style={{ width: "100%", ...submitStyle }}>
        {isSubmitting ? t("submitting") : t("submit")}
      </CtaButton>
      {onForgot ? (
        <button
          type="button"
          onClick={onForgot}
          style={{
            background: "none",
            border: "none",
            font: "inherit",
            cursor: "pointer",
            fontSize: "var(--fs-small)",
            color: "var(--color-text-muted)",
            textAlign: "center",
          }}
        >
          {t("forgot")}
        </button>
      ) : (
        <Link
          href="/reset-password"
          style={{
            fontSize: "var(--fs-small)",
            color: "var(--color-text-muted)",
            textAlign: "center",
          }}
        >
          {t("forgot")}
        </Link>
      )}
    </form>
  );
}
