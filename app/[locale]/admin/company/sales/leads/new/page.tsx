import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { LeadForm } from "@/components/admin/sales/lead-form";

export const dynamic = "force-dynamic";

export default async function NewLeadPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="grid gap-6">
      <Link
        href="/admin/company/sales/leads"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="size-4" />
        Back to leads
      </Link>
      <h1 className="text-foreground text-2xl font-bold tracking-tight">
        New lead
      </h1>
      <LeadForm />
    </div>
  );
}
