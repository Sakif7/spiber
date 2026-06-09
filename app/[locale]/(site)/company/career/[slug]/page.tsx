import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Mail, Phone, Briefcase, MapPin, type LucideIcon } from "lucide-react";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { Link } from "@/i18n/navigation";
import { Arrow } from "@/components/ui";
import { ApplyForm } from "@/components/company/career/apply-form";
import {
  getOpenJobBySlug,
  listRelatedJobs,
} from "@/lib/repositories/career.repo";
import { localize } from "@/lib/schemas/localized";
import { pageMetadata } from "@/lib/seo/metadata";
import { CONTACT } from "@/lib/contact";
import type { Lean } from "@/lib/models/_shared";
import type { IJobPosting } from "@/lib/models/jobPosting";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const job = await getOpenJobBySlug(slug).catch(() => null);
  const l = locale as Locale;
  if (!job) {
    return pageMetadata({
      locale: l,
      path: `/company/career/${slug}`,
      title: "Career",
    });
  }
  return pageMetadata({
    locale: l,
    path: `/company/career/${slug}`,
    title: localize(job.title, l),
    description: job.summary ? localize(job.summary, l) : undefined,
  });
}

/** Split a localized multiline string into clean bullet lines. */
function bullets(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.replace(/^[\s•\-*–·]+/, "").trim())
    .filter(Boolean);
}
/** Split body copy into paragraphs on blank lines. */
function paragraphs(text: string): string[] {
  const parts = text
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : [text.trim()].filter(Boolean);
}

export default async function JobDetail({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "career" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const job = await getOpenJobBySlug(slug).catch(() => null);
  if (!job) notFound();
  const related = await listRelatedJobs(String(job._id), 3).catch(() => []);

  const loc = (v?: { en: string; bn?: string }) => (v ? localize(v, l) : "");
  const responsibilities = job.responsibilities
    ? bullets(loc(job.responsibilities))
    : [];
  const requirements = job.requirements ? bullets(loc(job.requirements)) : [];
  const preferred = job.preferredSkills
    ? bullets(loc(job.preferredSkills))
    : [];
  const offers = job.benefits ? bullets(loc(job.benefits)) : [];
  const empType = t(`employmentTypes.${job.employmentType}`);

  const stats: { value: string; label: string }[] = [
    { value: empType, label: t("overview.employmentType") },
  ];
  if (job.location)
    stats.push({ value: loc(job.location), label: t("overview.location") });
  if (job.experience)
    stats.push({ value: loc(job.experience), label: t("overview.experience") });

  const overviewRows: { label: string; value: string }[] = [];
  if (job.department)
    overviewRows.push({
      label: t("overview.department"),
      value: loc(job.department),
    });
  if (job.reportsTo)
    overviewRows.push({
      label: t("overview.reportsTo"),
      value: loc(job.reportsTo),
    });
  if (job.location)
    overviewRows.push({
      label: t("overview.location"),
      value: loc(job.location),
    });
  overviewRows.push({ label: t("overview.employmentType"), value: empType });
  if (job.experience)
    overviewRows.push({
      label: t("overview.experience"),
      value: loc(job.experience),
    });
  if (job.vacancies != null)
    overviewRows.push({
      label: t("overview.vacancy"),
      value: t("vacancyCount", { count: job.vacancies }),
    });
  if (job.closesAt)
    overviewRows.push({
      label: t("overview.deadline"),
      value: new Date(job.closesAt).toLocaleDateString(l, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    });

  const recEmail = job.recruiterEmail || job.applyEmail || CONTACT.generalEmail;
  const recPhone = job.recruiterPhone || CONTACT.phone;
  const hiringSteps = t.raw("hiring.steps") as {
    title: string;
    desc: string;
  }[];

  return (
    <>
      <PageHeader
        eyebrow={t("hero.breadcrumb")}
        title={localize(job.title, l)}
        description={job.summary ? loc(job.summary) : undefined}
        image="/smiling-medical-team-portrait.jpeg"
        imageAlt={localize(job.title, l)}
        stats={stats}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: t("hero.breadcrumb"), href: "/company/career" },
          { label: localize(job.title, l) },
        ]}
      />

      <section
        style={{
          paddingBlock: "clamp(40px, 5vw, 72px)",
          background: "var(--color-surface-2)",
        }}
      >
        <Container>
          <Link
            href="/company/career"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              fontWeight: 500,
              color: "var(--color-brand-deep)",
              marginBottom: "var(--s-5)",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <path
                d="M15 6l-6 6 6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {t("back")}
          </Link>

          <div
            className="job-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.65fr) minmax(0, 1fr)",
              gap: "clamp(20px, 2.5vw, 36px)",
              alignItems: "start",
            }}
          >
            {/* ── Main (one panel, text headings) ── */}
            <section
              style={{ ...cardStyle, padding: "clamp(24px, 3vw, 38px)" }}
            >
              <Block title={t("aboutRole")} first>
                <div style={{ display: "grid", gap: 12 }}>
                  {paragraphs(loc(job.description)).map((p, i) => (
                    <p key={i} style={bodyText}>
                      {p}
                    </p>
                  ))}
                </div>
              </Block>

              {responsibilities.length > 0 && (
                <Block title={t("keyResponsibilities")}>
                  <BulletList items={responsibilities} />
                </Block>
              )}

              {requirements.length > 0 && (
                <Block title={t("requiredQualifications")}>
                  <BulletList items={requirements} />
                </Block>
              )}

              {preferred.length > 0 && (
                <Block title={t("preferredSkills")}>
                  <BulletList items={preferred} />
                </Block>
              )}

              {offers.length > 0 && (
                <Block title={t("whatWeOffer")}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: "10px 24px",
                    }}
                  >
                    {offers.map((o) => (
                      <div
                        key={o}
                        style={{
                          display: "flex",
                          gap: 12,
                          alignItems: "flex-start",
                        }}
                      >
                        <span
                          aria-hidden
                          style={{
                            marginTop: 8,
                            width: 6,
                            height: 6,
                            flexShrink: 0,
                            borderRadius: "50%",
                            background: "var(--color-brand)",
                          }}
                        />
                        <span
                          style={{
                            fontSize: "var(--fs-body)",
                            lineHeight: 1.6,
                            color: "var(--color-text)",
                          }}
                        >
                          {o}
                        </span>
                      </div>
                    ))}
                  </div>
                </Block>
              )}

              <Block title={t("aboutCompany")}>
                <p style={bodyText}>{t("companyBlurb")}</p>
              </Block>
            </section>

            {/* ── Sidebar ── */}
            <aside
              className="job-aside"
              style={{
                display: "grid",
                gap: "var(--s-4)",
                position: "sticky",
                top: 88,
              }}
            >
              {/* Job Overview */}
              <div style={cardStyle}>
                <h3 style={asideTitle}>{t("overview.title")}</h3>
                <div style={{ display: "grid", gap: 0 }}>
                  {overviewRows.map((r, i) => (
                    <div
                      key={r.label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 16,
                        padding: "10px 0",
                        borderTop:
                          i === 0 ? "none" : "1px solid var(--color-hairline)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {r.label}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--color-text-strong)",
                          textAlign: "right",
                        }}
                      >
                        {r.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Apply */}
              <div
                style={{
                  ...cardStyle,
                  background:
                    "linear-gradient(140deg, var(--brand-orange), color-mix(in oklab, var(--brand-orange) 78%, #b8431a))",
                  border: "none",
                  color: "#fff",
                  textAlign: "center",
                }}
              >
                <h3
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 600,
                    fontSize: 18,
                    margin: "0 0 8px",
                    color: "#fff",
                  }}
                >
                  {t("applyCard.title")}
                </h3>
                <p
                  style={{
                    margin: "0 0 18px",
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    color: "rgba(255,255,255,0.9)",
                  }}
                >
                  {t("applyCard.body")}
                </p>
                <a
                  href="#apply"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    width: "100%",
                    padding: "12px 20px",
                    borderRadius: "var(--r-pill)",
                    background: "#fff",
                    color: "var(--color-secondary-deep, #b8431a)",
                    fontWeight: 700,
                    fontSize: 15,
                    textDecoration: "none",
                  }}
                >
                  {t("applyCard.cta")} <Arrow size={16} />
                </a>
              </div>

              {/* Contact Recruiter */}
              <div style={cardStyle}>
                <h3 style={asideTitle}>{t("recruiterTitle")}</h3>
                {job.recruiterName && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      marginBottom: 14,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        display: "grid",
                        placeItems: "center",
                        width: 42,
                        height: 42,
                        flexShrink: 0,
                        borderRadius: "var(--r-pill)",
                        background: "var(--color-brand-soft)",
                        color: "var(--color-brand-deep)",
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        fontSize: 16,
                      }}
                    >
                      {job.recruiterName.charAt(0).toUpperCase()}
                    </span>
                    <span style={{ display: "grid", gap: 1 }}>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: 14.5,
                          color: "var(--color-text-strong)",
                        }}
                      >
                        {job.recruiterName}
                      </span>
                      {job.recruiterTitle && (
                        <span
                          style={{
                            fontSize: 12.5,
                            color: "var(--color-text-muted)",
                          }}
                        >
                          {loc(job.recruiterTitle)}
                        </span>
                      )}
                    </span>
                  </div>
                )}
                <div style={{ display: "grid", gap: 10 }}>
                  <ContactLine icon={Mail} href={`mailto:${recEmail}`}>
                    {recEmail}
                  </ContactLine>
                  <ContactLine
                    icon={Phone}
                    href={`tel:${recPhone.replace(/\s+/g, "")}`}
                  >
                    {recPhone}
                  </ContactLine>
                </div>
              </div>

              {/* Hiring Process */}
              <div style={cardStyle}>
                <h3 style={asideTitle}>{t("hiring.title")}</h3>
                <ol
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    display: "grid",
                    gap: 0,
                  }}
                >
                  {hiringSteps.map((s, i) => (
                    <li
                      key={i}
                      style={{ display: "flex", gap: 12, position: "relative" }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        <span
                          aria-hidden
                          style={{
                            display: "grid",
                            placeItems: "center",
                            width: 26,
                            height: 26,
                            borderRadius: "var(--r-pill)",
                            background: "var(--color-brand)",
                            color: "#fff",
                            fontFamily: "var(--font-mono)",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {i + 1}
                        </span>
                        {i < hiringSteps.length - 1 && (
                          <span
                            aria-hidden
                            style={{
                              width: 2,
                              flex: 1,
                              minHeight: 18,
                              background: "var(--color-hairline)",
                            }}
                          />
                        )}
                      </div>
                      <div
                        style={{
                          paddingBottom: i < hiringSteps.length - 1 ? 16 : 0,
                        }}
                      >
                        <span
                          style={{
                            display: "block",
                            fontWeight: 600,
                            fontSize: 14,
                            color: "var(--color-text-strong)",
                          }}
                        >
                          {s.title}
                        </span>
                        <span
                          style={{
                            fontSize: 12.5,
                            color: "var(--color-text-muted)",
                          }}
                        >
                          {s.desc}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </aside>
          </div>
        </Container>
      </section>

      {/* Apply form */}
      <section
        id="apply"
        style={{
          paddingBlock: "clamp(40px, 5vw, 72px)",
          background: "var(--color-surface)",
        }}
      >
        <Container narrow>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: "var(--fs-h3)",
              letterSpacing: "-.02em",
              color: "var(--color-text-strong)",
              margin: "0 0 var(--s-6)",
              textAlign: "center",
            }}
          >
            {t("form.title")}
          </h2>
          <div style={{ maxWidth: 680, marginInline: "auto" }}>
            <ApplyForm jobId={String(job._id)} />
          </div>
        </Container>
      </section>

      {/* Related opportunities */}
      {related.length > 0 && (
        <section
          style={{
            paddingBlock: "clamp(40px, 5vw, 72px)",
            background: "var(--color-surface-2)",
          }}
        >
          <Container>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: "var(--fs-h3)",
                letterSpacing: "-.02em",
                color: "var(--color-text-strong)",
                margin: "0 0 var(--s-6)",
              }}
            >
              {t("related")}
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "var(--s-4)",
              }}
            >
              {related.map((r) => (
                <RelatedCard
                  key={String(r._id)}
                  job={r}
                  locale={l}
                  typeLabel={t(`employmentTypes.${r.employmentType}`)}
                  viewLabel={t("viewDetails")}
                />
              ))}
            </div>
          </Container>
        </section>
      )}
      <style>{`
        .related-job-card { transition: transform 280ms cubic-bezier(.16,1,.3,1), box-shadow 280ms cubic-bezier(.16,1,.3,1), border-color 280ms; }
        .related-job-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); border-color: var(--teal-300); }
        @media (max-width: 920px) {
          .job-grid { grid-template-columns: 1fr !important; }
          .job-aside { position: static !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .related-job-card { transition: none; }
          .related-job-card:hover { transform: none; }
        }
      `}</style>
    </>
  );
}

const cardStyle: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-hairline)",
  borderRadius: "var(--r-xl)",
  padding: "clamp(20px, 2.4vw, 28px)",
  boxShadow: "var(--shadow-xs)",
};
const asideTitle: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: 16,
  color: "var(--color-text-strong)",
  margin: "0 0 14px",
};
const bodyText: React.CSSProperties = {
  margin: 0,
  fontSize: "var(--fs-body)",
  lineHeight: 1.7,
  color: "var(--color-text-muted)",
};

function Block({
  title,
  children,
  first,
}: {
  title: string;
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <div
      style={{
        paddingTop: first ? 0 : "clamp(22px, 2.6vw, 30px)",
        marginTop: first ? 0 : "clamp(22px, 2.6vw, 30px)",
        borderTop: first ? "none" : "1px solid var(--color-hairline)",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: "var(--fs-h5)",
          letterSpacing: "-.01em",
          color: "var(--color-text-strong)",
          margin: "0 0 14px",
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "grid",
        gap: 11,
      }}
    >
      {items.map((it) => (
        <li
          key={it}
          style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
        >
          <span
            aria-hidden
            style={{
              marginTop: 8,
              width: 6,
              height: 6,
              flexShrink: 0,
              borderRadius: "50%",
              background: "var(--color-brand)",
            }}
          />
          <span
            style={{
              fontSize: "var(--fs-body)",
              lineHeight: 1.6,
              color: "var(--color-text)",
            }}
          >
            {it}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ContactLine({
  icon: Icon,
  href,
  children,
}: {
  icon: LucideIcon;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 13.5,
        color: "var(--color-text)",
        textDecoration: "none",
      }}
    >
      <span
        aria-hidden
        style={{
          display: "grid",
          placeItems: "center",
          width: 32,
          height: 32,
          flexShrink: 0,
          borderRadius: "var(--r-md)",
          background: "var(--color-surface-2)",
          color: "var(--color-brand-deep)",
        }}
      >
        <Icon size={15} strokeWidth={1.9} />
      </span>
      {children}
    </a>
  );
}

function RelatedCard({
  job,
  locale,
  typeLabel,
  viewLabel,
}: {
  job: Lean<IJobPosting>;
  locale: Locale;
  typeLabel: string;
  viewLabel: string;
}) {
  const loc = (v?: { en: string; bn?: string }) =>
    v ? localize(v, locale) : "";
  const metaBits = [
    loc(job.location),
    `${typeLabel}${job.experience ? ` · ${loc(job.experience)}` : ""}`,
  ].filter(Boolean);
  return (
    <Link
      href={`/company/career/${job.slug}`}
      className="related-job-card"
      style={{
        display: "grid",
        gap: 10,
        padding: "22px 22px 20px",
        borderRadius: "var(--r-xl)",
        background: "var(--color-surface)",
        border: "1px solid var(--color-hairline)",
        boxShadow: "var(--shadow-xs)",
        textDecoration: "none",
      }}
    >
      <span
        aria-hidden
        style={{
          display: "grid",
          placeItems: "center",
          width: 40,
          height: 40,
          borderRadius: "var(--r-md)",
          background: "var(--color-brand-soft)",
          color: "var(--color-brand)",
        }}
      >
        <Briefcase size={19} strokeWidth={1.9} />
      </span>
      <h3
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: 16.5,
          letterSpacing: "-.01em",
          color: "var(--color-text-strong)",
          margin: 0,
        }}
      >
        {loc(job.title)}
      </h3>
      {job.department && (
        <span
          style={{
            fontSize: 13,
            color: "var(--color-brand-deep)",
            fontWeight: 500,
          }}
        >
          {loc(job.department)}
        </span>
      )}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12.5,
          color: "var(--color-text-muted)",
        }}
      >
        <MapPin size={13} aria-hidden />
        {metaBits.join(" · ")}
      </span>
      <span
        style={{
          marginTop: 4,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13.5,
          fontWeight: 600,
          color: "var(--color-brand-deep)",
        }}
      >
        {viewLabel} <Arrow size={13} />
      </span>
    </Link>
  );
}
