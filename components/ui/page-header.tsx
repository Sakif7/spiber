import { Container } from "./container";
import { Eyebrow } from "./eyebrow";
import { Reveal } from "./reveal";
import { Breadcrumb, type Crumb } from "./breadcrumb";

type Props = {
  title: string;
  eyebrow?: string;
  description?: string;
  breadcrumbs?: Crumb[];
};

/** Standard interior-page header: optional breadcrumb + eyebrow + title + lede. */
export function PageHeader({
  title,
  eyebrow,
  description,
  breadcrumbs,
}: Props) {
  return (
    <header
      style={{
        paddingTop: "calc(var(--s-24) + 40px)",
        paddingBottom: "var(--s-12)",
        borderBottom: "1px solid var(--color-hairline)",
        background: "var(--color-surface)",
      }}
    >
      <Container>
        <Reveal>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-4)",
            }}
          >
            {breadcrumbs && breadcrumbs.length > 0 && (
              <Breadcrumb items={breadcrumbs} />
            )}
            {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
            <h1
              style={{
                fontSize: "var(--fs-h1)",
                lineHeight: "var(--lh-heading)",
                letterSpacing: "var(--tracking-heading)",
                color: "var(--color-text-strong)",
                maxWidth: "20ch",
              }}
            >
              {title}
            </h1>
            {description && (
              <p
                style={{
                  fontSize: "var(--fs-body-lg)",
                  color: "var(--color-text-muted)",
                  maxWidth: "60ch",
                }}
              >
                {description}
              </p>
            )}
          </div>
        </Reveal>
      </Container>
    </header>
  );
}
