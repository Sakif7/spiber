import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DestinationForm } from "@/components/admin/tourism/catalog-form";

export const dynamic = "force-dynamic";

export default async function NewDestinationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <div style={{ display: "grid", gap: "var(--s-2)" }}>
        <Link
          href="/admin/tourism/destinations"
          style={{
            fontSize: "var(--fs-small)",
            color: "var(--color-text-muted)",
          }}
        >
          ← Destinations
        </Link>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-2xl)",
            color: "var(--color-text-strong)",
          }}
        >
          New destination
        </h1>
      </div>
      <DestinationForm />
    </div>
  );
}
