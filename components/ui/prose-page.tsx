import { getTranslations } from "next-intl/server";
import { Container } from "./container";
import { PageHeader } from "./page-header";
import type { Locale } from "@/i18n/routing";

/** One headed part of a long page, from `<namespace>.sections`. */
type ProseSection = {
  /** The anchor a link can land on (`/privacy#cookies`). */
  id: string;
  heading: string;
  paragraphs?: string[];
  items?: string[];
  links?: { label: string; href: string }[];
};

/**
 * Simple interior content page (about, legal): localized header + a prose body.
 * Reads `title`, `description`, and `body` from the given catalog namespace;
 * a long page (the privacy policy) adds `updated` and headed `sections`,
 * set in the blog's prose styles.
 */
export async function ProsePage({
  locale,
  namespace,
}: {
  locale: Locale;
  namespace: string;
}) {
  const t = await getTranslations({ locale, namespace });
  const nav = await getTranslations({ locale, namespace: "nav" });
  const sections = t.has("sections")
    ? (t.raw("sections") as ProseSection[])
    : [];

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: nav("home"), href: "/" }, { label: t("title") }]}
      />
      <section style={{ paddingBlock: "clamp(48px, 6vw, 96px)" }}>
        <Container narrow>
          <p
            style={{
              fontSize: "var(--fs-body-lg)",
              color: "var(--color-text)",
              lineHeight: "var(--lh-body)",
            }}
          >
            {t("body")}
          </p>
          {sections.length > 0 && (
            <div
              className="blog-prose"
              style={{
                fontSize: "var(--fs-body-lg)",
                lineHeight: "var(--lh-body)",
                color: "var(--color-text)",
              }}
            >
              {t.has("updated") && (
                <p style={{ color: "var(--color-text-muted)" }}>
                  {t("updated")}
                </p>
              )}
              {sections.map((s) => (
                <section key={s.id} id={s.id} style={{ scrollMarginTop: 96 }}>
                  <h2>{s.heading}</h2>
                  {s.paragraphs?.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                  {s.items && (
                    <ul>
                      {s.items.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  )}
                  {s.links && (
                    <ul>
                      {s.links.map((l) => (
                        <li key={l.href}>
                          <a
                            href={l.href}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {l.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
