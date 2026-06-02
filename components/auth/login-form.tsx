"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { loginFormSchema, type LoginFormValues } from "@/lib/schemas/user";
import { isAdmin } from "@/lib/auth/rbac";
import { routing } from "@/i18n/routing";

/**
 * Strip a leading locale segment (e.g. "/en/admin" → "/admin") so the
 * locale-aware router doesn't double-prefix it ("/en/en/admin"). `next` can
 * arrive locale-prefixed from the proxy/guard redirects or a bookmarked URL.
 */
function stripLocale(path: string): string {
  for (const loc of routing.locales) {
    if (path === `/${loc}`) return "/";
    if (path.startsWith(`/${loc}/`)) return path.slice(loc.length + 1);
  }
  return path;
}
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CtaButton } from "@/components/ui/cta-button";

export function LoginForm({
  next,
  verified,
}: {
  next?: string;
  verified?: boolean;
}) {
  const t = useTranslations("auth.login");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: "", password: "" },
  });

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
        // An explicit ?next= wins; otherwise admins land on the admin panel,
        // everyone else on the homepage.
        const dest =
          next && next.startsWith("/")
            ? stripLocale(next)
            : isAdmin({ roles: json.data?.user?.roles ?? [] })
              ? "/admin"
              : "/";
        router.replace(dest);
        router.refresh();
        return;
      }
      const code = json?.error?.code;
      if (code === "invalid_credentials") setError(t("errorInvalid"));
      else if (code === "email_not_verified") setError(t("errorUnverified"));
      else setError(t("errorGeneric"));
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
      <CtaButton type="submit" style={{ width: "100%" }}>
        {isSubmitting ? t("submitting") : t("submit")}
      </CtaButton>
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
    </form>
  );
}
