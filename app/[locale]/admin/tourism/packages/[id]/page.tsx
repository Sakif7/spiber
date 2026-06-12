import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { PackageForm } from "@/components/admin/tourism/catalog-form";
import { getPackageByIdLean } from "@/lib/repositories/packages.repo";

export const dynamic = "force-dynamic";

export default async function EditPackagePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const doc = await getPackageByIdLean(id).catch(() => null);
  if (!doc) notFound();
  const initial = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <div style={{ display: "grid", gap: "var(--s-2)" }}>
        <Link
          href="/admin/tourism/packages"
          style={{
            fontSize: "var(--fs-small)",
            color: "var(--color-text-muted)",
          }}
        >
          ← Packages
        </Link>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-2xl)",
            color: "var(--color-text-strong)",
          }}
        >
          Edit package
        </h1>
      </div>
      <PackageForm id={id} initial={initial} />
    </div>
  );
}
