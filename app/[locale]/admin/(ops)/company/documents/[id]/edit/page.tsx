import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/current-user";
import { isSuperAdmin } from "@/lib/auth/rbac";
import { companyContext } from "@/lib/pdf/engine/context";
import { getDocument } from "@/lib/services/documents/authored-document.service";
import { signedBodyFor } from "@/lib/services/documents/document-signing.service";
import { reviewStateOf } from "@/lib/services/documents/document-review.service";
import { documentSettingsSchema } from "@/lib/schemas/authored-document";
import { DocumentEditor } from "@/components/admin/documents/document-editor";

export const dynamic = "force-dynamic";

/** The writing desk. A sent document opens read-only here. */
export default async function DocumentEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await getSessionUser();
  if (!isSuperAdmin(user)) redirect(`/${locale}/admin/company/documents`);
  const doc = await getDocument(id);
  if (!doc) notFound();
  // Signed slots show the signature on screen (a private, per-request URL);
  // while drafting nothing is signed and the body is used as stored.
  const body =
    doc.status === "sent" || doc.status === "completed"
      ? await signedBodyFor(doc, "screen")
      : doc.body;

  return (
    <DocumentEditor
      document={{
        id: String(doc._id),
        type: doc.type,
        number: doc.number ?? null,
        title: doc.title,
        status: doc.status,
        body,
        rev: doc.rev ?? 0,
        settings: documentSettingsSchema.parse(doc.settings ?? {}),
        versions: (doc.versions ?? []).map((v) => ({
          n: v.n,
          label: v.label,
          note: v.note ?? null,
          pages: v.pages ?? null,
          createdAt: v.createdAt.toISOString(),
        })),
        pendingRecipients: (doc.recipients ?? []).filter(
          (r) => r.status === "pending",
        ).length,
        mergeEmployeeId: doc.mergeEmployeeId
          ? String(doc.mergeEmployeeId)
          : null,
        review: reviewStateOf(doc),
      }}
      company={companyContext()}
      logoSrc="/pdf/letterhead-logo.png"
    />
  );
}
