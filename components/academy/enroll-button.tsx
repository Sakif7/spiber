"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { CtaButton } from "@/components/ui/cta-button";
import { useSession } from "@/components/auth/use-session";
import { useAuthModal } from "@/components/auth/auth-modal";

export function EnrollButton({
  courseId,
  slug,
  enrolled,
  firstLessonId,
}: {
  courseId: string;
  slug: string;
  enrolled: boolean;
  firstLessonId?: string;
}) {
  const t = useTranslations("academy.course");
  const router = useRouter();
  const { user, isLoading } = useSession();
  const { open } = useAuthModal();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const courseHref = firstLessonId
    ? `/medacademy/course/${slug}/learn/${firstLessonId}`
    : `/medacademy/course/${slug}`;

  if (enrolled) {
    return (
      <CtaButton
        href={courseHref}
        variant="primary"
        style={{ background: "var(--color-secondary)" }}
      >
        {t("goToCourse")}
      </CtaButton>
    );
  }

  if (!isLoading && !user) {
    return (
      <CtaButton
        onClick={() => open("login", { next: `/medacademy/course/${slug}` })}
        style={{ background: "var(--color-secondary)" }}
      >
        {t("signInToEnroll")}
      </CtaButton>
    );
  }

  async function enroll() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/academy/enrollment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, idempotencyKey: crypto.randomUUID() }),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok && json?.ok) {
      router.push(`/medacademy/enrollment/${json.data.enrollmentNumber}`);
      router.refresh();
    } else {
      setError(json?.error?.code ?? "enroll_failed");
    }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <CtaButton
        onClick={enroll}
        style={{
          background: "var(--color-secondary)",
          opacity: busy || isLoading ? 0.7 : 1,
        }}
      >
        {busy ? t("enrolling") : t("enrollNow")}
      </CtaButton>
      {error && (
        <span
          style={{ color: "var(--color-error)", fontSize: "var(--fs-caption)" }}
        >
          {error === "already_enrolled" ? t("alreadyEnrolled") : error}
        </span>
      )}
    </div>
  );
}
