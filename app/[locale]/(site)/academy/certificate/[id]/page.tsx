import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/ui/container";
import { PrintButton } from "@/components/academy/print-button";
import { getEnrollmentByCertificateId } from "@/lib/repositories/enrollments.repo";
import { getCourseById } from "@/lib/repositories/courses.repo";
import { findUserById } from "@/lib/repositories/users.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { isAdmin } from "@/lib/auth/rbac";
import { localize } from "@/lib/schemas/localized";
import { bcp47 } from "@/lib/i18n/intl-locale";
import { siteConfig } from "@/lib/site-config";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "academy.certificate" });

  const enrollment = await getEnrollmentByCertificateId(id);
  if (!enrollment || !enrollment.completedAt) notFound();

  // Certificates are private: only the owner (or an admin) may view one.
  const session = await getSessionUser();
  if (!session) {
    redirect(
      `/${l}?auth=login&next=${encodeURIComponent(`/${l}/academy/certificate/${id}`)}`,
    );
  }
  const isOwner = session.sub === String(enrollment.userId);
  if (!isOwner && !isAdmin(session)) notFound();

  const [course, user] = await Promise.all([
    getCourseById(String(enrollment.courseId)),
    findUserById(String(enrollment.userId)).catch(() => null),
  ]);
  const courseTitle = course ? localize(course.title, l) : "";
  const name = user?.name || enrollment.email.split("@")[0];
  const issued = new Date(enrollment.completedAt).toLocaleDateString(bcp47(l), {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <section style={{ paddingBlock: "clamp(48px, 6vw, 96px)" }}>
      <Container style={{ maxWidth: 760, display: "grid", gap: "var(--s-6)" }}>
        <div
          style={{
            position: "relative",
            border: "2px solid var(--color-secondary)",
            borderRadius: "var(--r-xl)",
            padding: "clamp(32px, 6vw, 72px)",
            background:
              "linear-gradient(160deg, var(--orange-50), var(--color-surface) 55%)",
            textAlign: "center",
            display: "grid",
            gap: "var(--s-5)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--fs-caption)",
              textTransform: "uppercase",
              letterSpacing: "var(--tracking-eyebrow)",
              color: "var(--color-secondary-deep)",
            }}
          >
            {siteConfig.brand} · {t("title")}
          </span>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            {t("awardedTo")}
          </p>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontSize: "var(--fs-h1)",
              color: "var(--color-text-strong)",
            }}
          >
            {name}
          </h1>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            {t("forCompleting")}
          </p>
          <h2
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontSize: "var(--fs-h3)",
              color: "var(--color-secondary-deep)",
            }}
          >
            {courseTitle}
          </h2>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "var(--s-8)",
              flexWrap: "wrap",
              marginTop: "var(--s-4)",
              fontSize: "var(--fs-body-sm)",
              color: "var(--color-text-muted)",
            }}
          >
            <span>
              {t("issued")}:{" "}
              <strong style={{ color: "var(--color-text)" }}>{issued}</strong>
            </span>
            <span>
              {t("id")}:{" "}
              <strong
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-text)",
                }}
              >
                {enrollment.certificateId}
              </strong>
            </span>
          </div>
        </div>
        <div style={{ justifySelf: "center" }} className="no-print">
          <PrintButton />
        </div>
      </Container>
      <style>{`@media print { .no-print { display: none !important; } header, footer { display: none !important; } }`}</style>
    </section>
  );
}
