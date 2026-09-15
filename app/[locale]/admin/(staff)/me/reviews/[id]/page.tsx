import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { companyContext } from "@/lib/pdf/engine/context";
import { reviewFor } from "@/lib/services/documents/document-review.service";
import { DocumentReview } from "@/components/admin/documents/document-review";
import { reviewerOrRedirect } from "../../_shared";

export const dynamic = "force-dynamic";

/** The reviewer's desk: the draft as it stands, read-only, with the threads. */
export default async function ReviewDocumentPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const actor = await reviewerOrRedirect(locale, `/admin/me/reviews/${id}`);
  const desk = await reviewFor(actor, id);
  if (!desk) notFound();

  return (
    <DocumentReview
      desk={desk}
      company={companyContext()}
      logoSrc="/pdf/letterhead-logo.png"
    />
  );
}
