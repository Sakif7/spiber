/**
 * Renders a JSON-LD structured-data script. Server component; feed it builders
 * from `@/lib/seo/jsonld` (organizationJsonLd, breadcrumbJsonLd, …).
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
