import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ProductRequestActions } from "@/components/admin/product-request-actions";
import { getProductRequestByIdLean } from "@/lib/repositories/product-requests.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { EditorHeader } from "@/components/admin/ui/form-shell";
import {
  DetailCard,
  DetailLayout,
  DetailMeta,
  DetailProse,
  DetailRow,
} from "@/components/admin/ui/detail";
import { StatusBadge } from "@/components/admin/ui/status-badge";

export const dynamic = "force-dynamic";

export default async function AdminProductRequestDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const r = await getProductRequestByIdLean(id).catch(() => null);
  if (!r) notFound();
  const user = await getSessionUser();
  const assignedToMe = Boolean(
    user && r.assignedTo && String(r.assignedTo) === user.sub,
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <EditorHeader
          backHref="/admin/product-requests"
          backLabel="Product requests"
          title={r.productName}
          action={<StatusBadge>{r.status}</StatusBadge>}
        />
        <DetailMeta>{r.requestNumber}</DetailMeta>
      </div>

      <DetailLayout
        aside={
          <ProductRequestActions
            requestId={String(r._id)}
            status={r.status}
            currentUserId={user?.sub ?? ""}
            assignedToMe={assignedToMe}
          />
        }
      >
        <DetailCard>
          <DetailRow label="Product">{r.productName}</DetailRow>
          {r.category && <DetailRow label="Category">{r.category}</DetailRow>}
          {r.brand && <DetailRow label="Brand">{r.brand}</DetailRow>}
          {r.quantity != null && (
            <DetailRow label="Quantity">{String(r.quantity)}</DetailRow>
          )}
          {r.budget && <DetailRow label="Budget">{r.budget}</DetailRow>}
          {r.referenceUrl && (
            <DetailRow label="Reference URL" mono>
              {r.referenceUrl}
            </DetailRow>
          )}
        </DetailCard>

        <DetailCard>
          <DetailRow label="Requested by">{r.name}</DetailRow>
          <DetailRow label="Email">{r.email}</DetailRow>
          {r.phone && <DetailRow label="Phone">{r.phone}</DetailRow>}
        </DetailCard>

        {r.details && (
          <DetailCard title="Details">
            <DetailProse>{r.details}</DetailProse>
          </DetailCard>
        )}

        {r.notes.length > 0 && (
          <DetailCard title="Notes">
            {r.notes.map((n, i) => (
              <div key={i} className="grid gap-0.5">
                <span className="text-foreground">{n.body}</span>
                <span className="text-muted-foreground text-xs">
                  {new Date(n.at).toLocaleString()}
                </span>
              </div>
            ))}
          </DetailCard>
        )}
      </DetailLayout>
    </div>
  );
}
