import Image from "next/image";
import { Info, TriangleAlert } from "lucide-react";
import type { Guide, GuideBlock, GuideSection } from "@/lib/guide/types";
import { cn } from "@/lib/cn";

/**
 * Renders a written guide (see lib/guide/types) as readable documentation:
 * a contents list, then numbered sections with screenshots.
 *
 * `tone` picks the surrounding design language. "site" is used on the public
 * user guide, where the brand tokens are in play; "admin" is used inside the
 * admin, where the shadcn semantic tokens are.
 */
export function GuideBody({
  guide,
  imageBase,
  tone = "site",
}: {
  guide: Guide;
  /** Public path the figures live under, e.g. "/guide" or "/guide/admin". */
  imageBase: string;
  tone?: "site" | "admin";
}) {
  const t = tokens(tone);

  return (
    <div className={t.root}>
      <nav aria-label="Contents" className={t.tocWrap}>
        <p className={t.tocTitle}>On this page</p>
        <ol className={t.tocList}>
          {guide.sections.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className={t.tocLink}>
                <span className={t.tocNum}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className={t.sections}>
        {guide.sections.map((section, i) => (
          <GuideSectionView
            key={section.id}
            section={section}
            index={i + 1}
            imageBase={imageBase}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

function GuideSectionView({
  section,
  index,
  imageBase,
  t,
}: {
  section: GuideSection;
  index: number;
  imageBase: string;
  t: ReturnType<typeof tokens>;
}) {
  return (
    <section id={section.id} className={t.section}>
      <div className={t.sectionHead}>
        <span className={t.sectionNum}>{String(index).padStart(2, "0")}</span>
        <div className="min-w-0">
          <h2 className={t.h2}>{section.title}</h2>
          {section.lede && <p className={t.lede}>{section.lede}</p>}
        </div>
      </div>
      <div className={t.blocks}>
        {section.blocks.map((block, i) => (
          <BlockView key={i} block={block} imageBase={imageBase} t={t} />
        ))}
      </div>
    </section>
  );
}

function BlockView({
  block,
  imageBase,
  t,
}: {
  block: GuideBlock;
  imageBase: string;
  t: ReturnType<typeof tokens>;
}) {
  switch (block.kind) {
    case "text":
      return <p className={t.p}>{block.body}</p>;

    case "steps":
      return (
        <ol className={t.steps}>
          {block.steps.map((s, i) => (
            <li key={i} className={t.step}>
              <span className={t.stepNum}>{i + 1}</span>
              <span className={t.stepBody}>{s}</span>
            </li>
          ))}
        </ol>
      );

    case "list":
      return (
        <ul className={t.list}>
          {block.items.map((item, i) => (
            <li key={i} className={t.listItem}>
              {item}
            </li>
          ))}
        </ul>
      );

    case "definitions":
      return (
        <dl className={t.defs}>
          {block.items.map((d, i) => (
            <div key={i} className={t.def}>
              <dt className={t.dt}>{d.term}</dt>
              <dd className={t.dd}>{d.def}</dd>
            </div>
          ))}
        </dl>
      );

    case "callout": {
      const warn = block.tone === "warning";
      const Icon = warn ? TriangleAlert : Info;
      return (
        <div className={cn(t.callout, warn ? t.calloutWarn : t.calloutNote)}>
          <Icon aria-hidden className={t.calloutIcon} />
          <div className="min-w-0">
            {block.title && <p className={t.calloutTitle}>{block.title}</p>}
            <p className={t.calloutBody}>{block.body}</p>
          </div>
        </div>
      );
    }

    case "figure":
      return (
        <figure className={t.figure}>
          <div className={cn(t.figureFrame, block.figure.wide && t.figureWide)}>
            <Image
              src={`${imageBase}/${block.figure.src}.jpg`}
              alt={block.figure.caption}
              width={1000}
              height={700}
              sizes="(max-width: 900px) 100vw, 760px"
              className="h-auto w-full"
            />
          </div>
          <figcaption className={t.figcaption}>
            {block.figure.caption}
          </figcaption>
        </figure>
      );
  }
}

/** Class sets per surface, so one renderer serves the site and the admin. */
function tokens(tone: "site" | "admin") {
  const admin = tone === "admin";
  return {
    root: "grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-10",
    tocWrap: cn(
      "rounded-lg p-4 lg:sticky lg:top-20",
      admin
        ? "bg-card shadow-[var(--shadow-sm)]"
        : "bg-[var(--color-surface-2)]",
    ),
    tocTitle: cn(
      "mb-2 font-mono text-[11px] tracking-[0.12em] uppercase",
      admin ? "text-muted-foreground" : "text-[var(--color-text-muted)]",
    ),
    tocList: "grid gap-1",
    tocLink: cn(
      "flex gap-2 rounded px-1.5 py-1 text-[13px] transition-colors",
      admin
        ? "text-muted-foreground hover:text-foreground hover:bg-muted"
        : "text-[var(--color-text-muted)] hover:text-[var(--color-brand-deep)]",
    ),
    tocNum: cn(
      "font-mono text-[11px] tabular-nums",
      admin ? "text-muted-foreground/70" : "text-[var(--color-text-subtle)]",
    ),
    sections: "grid min-w-0 gap-12",
    section: "grid scroll-mt-24 gap-4",
    sectionHead: "flex items-start gap-3 border-b pb-3",
    sectionNum: cn(
      "mt-0.5 font-mono text-[13px] tabular-nums",
      admin ? "text-muted-foreground" : "text-[var(--color-brand)]",
    ),
    h2: cn(
      "text-lg font-bold tracking-tight sm:text-xl",
      admin ? "text-foreground" : "text-[var(--color-text-strong)]",
    ),
    lede: cn(
      "mt-1 text-[14px]",
      admin ? "text-muted-foreground" : "text-[var(--color-text-muted)]",
    ),
    blocks: "grid gap-4",
    p: cn(
      "text-[14px] leading-relaxed",
      admin ? "text-foreground" : "text-[var(--color-text)]",
    ),
    steps: "grid gap-2.5",
    step: "flex gap-3",
    stepNum: cn(
      "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
      admin
        ? "bg-primary text-primary-foreground"
        : "bg-[var(--color-brand)] text-white",
    ),
    stepBody: cn(
      "min-w-0 text-[14px] leading-relaxed",
      admin ? "text-foreground" : "text-[var(--color-text)]",
    ),
    list: "grid gap-2 pl-1",
    listItem: cn(
      "relative pl-4 text-[14px] leading-relaxed before:absolute before:top-[0.6em] before:left-0 before:size-1.5 before:rounded-full",
      admin
        ? "text-foreground before:bg-muted-foreground/60"
        : "text-[var(--color-text)] before:bg-[var(--color-brand)]",
    ),
    defs: cn(
      "grid divide-y rounded-lg",
      admin
        ? "bg-card shadow-[var(--shadow-sm)]"
        : "bg-[var(--color-surface-2)]",
    ),
    def: "grid gap-1 px-4 py-3 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-4",
    dt: cn(
      "text-[13px] font-semibold",
      admin ? "text-foreground" : "text-[var(--color-text-strong)]",
    ),
    dd: cn(
      "text-[13px] leading-relaxed",
      admin ? "text-muted-foreground" : "text-[var(--color-text-muted)]",
    ),
    callout: "flex gap-3 rounded-lg border p-3.5",
    calloutNote: admin
      ? "border-primary/30 bg-primary/5"
      : "border-[color-mix(in_srgb,var(--color-brand)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-brand)_7%,transparent)]",
    calloutWarn: admin
      ? "border-[color-mix(in_srgb,var(--color-warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)]"
      : "border-[color-mix(in_srgb,var(--color-warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)]",
    calloutIcon: cn(
      "mt-0.5 size-4 shrink-0",
      admin ? "text-foreground" : "text-[var(--color-text)]",
    ),
    calloutTitle: cn(
      "text-[13px] font-semibold",
      admin ? "text-foreground" : "text-[var(--color-text-strong)]",
    ),
    calloutBody: cn(
      "text-[13px] leading-relaxed",
      admin ? "text-foreground/90" : "text-[var(--color-text)]",
    ),
    figure: "grid gap-2",
    figureFrame: cn(
      "overflow-hidden rounded-lg border",
      admin
        ? "border-border bg-muted"
        : "border-[var(--color-border)] bg-[var(--color-surface-2)]",
    ),
    figureWide: "",
    figcaption: cn(
      "text-[12px] leading-relaxed",
      admin ? "text-muted-foreground" : "text-[var(--color-text-muted)]",
    ),
  };
}
