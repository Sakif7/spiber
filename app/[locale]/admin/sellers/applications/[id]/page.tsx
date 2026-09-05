import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { SellerApplicationActions } from "@/components/admin/seller-application-actions";
import { getSellerApplicationByIdLean } from "@/lib/repositories/seller-applications.repo";
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

const DOC_LABELS: Record<string, string> = {
  trade_license: "Trade license",
  national_id: "National ID (NID)",
  tin_certificate: "TIN certificate",
  bank_statement: "Bank statement / cheque leaf",
};

export default async function AdminSellerApplicationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const a = await getSellerApplicationByIdLean(id).catch(() => null);
  if (!a) notFound();
  const user = await getSessionUser();
  const assignedToMe = Boolean(
    user && a.assignedTo && String(a.assignedTo) === user.sub,
  );

  const bank = a.bankDetails;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <EditorHeader
          backHref="/admin/sellers/applications"
          backLabel="Applications"
          title={a.businessName}
          action={<StatusBadge>{a.status}</StatusBadge>}
        />
        <DetailMeta>{a.applicationNumber}</DetailMeta>
      </div>

      <DetailLayout
        aside={
          <SellerApplicationActions
            applicationId={String(a._id)}
            status={a.status}
            currentUserId={user?.sub ?? ""}
            assignedToMe={assignedToMe}
          />
        }
      >
        <DetailCard>
          <DetailRow label="Business">{a.businessName}</DetailRow>
          <DetailRow label="Contact">{a.contactName}</DetailRow>
          <DetailRow label="Email">{a.email}</DetailRow>
          {a.phone && <DetailRow label="Phone">{a.phone}</DetailRow>}
          {a.website && (
            <DetailRow label="Website" mono>
              {a.website}
            </DetailRow>
          )}
          {a.address && <DetailRow label="Address">{a.address}</DetailRow>}
          {a.categories && (
            <DetailRow label="Categories">{a.categories}</DetailRow>
          )}
        </DetailCard>

        <DetailCard title="Description">
          <DetailProse>{a.description}</DetailProse>
        </DetailCard>

        {a.documents && a.documents.length > 0 ? (
          <DetailCard title="Verification documents">
            {a.documents.map((d, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <span className="grid min-w-0 gap-0.5">
                  <span className="text-foreground font-medium">
                    {DOC_LABELS[d.label] ?? d.label}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {d.filename}
                    {d.size ? ` · ${Math.round(d.size / 1024)} KB` : ""}
                  </span>
                </span>
                <a
                  href={`/api/media/seller-application/${String(a._id)}/${i}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary shrink-0 font-medium hover:underline"
                >
                  View
                </a>
              </div>
            ))}
            {a.termsAcceptedAt && (
              <span className="text-muted-foreground text-xs">
                Seller terms accepted{" "}
                {new Date(a.termsAcceptedAt).toLocaleString()}
              </span>
            )}
          </DetailCard>
        ) : (
          <DetailCard title="Verification documents">
            <span className="text-muted-foreground">
              None uploaded (application predates document verification).
            </span>
          </DetailCard>
        )}

        {bank && (
          <DetailCard title="Bank details">
            {bank.accountName && (
              <DetailRow label="Account name">{bank.accountName}</DetailRow>
            )}
            {bank.bankName && (
              <DetailRow label="Bank">{bank.bankName}</DetailRow>
            )}
            {bank.accountNumber && (
              <DetailRow label="Account number" mono>
                {bank.accountNumber}
              </DetailRow>
            )}
            {bank.branch && <DetailRow label="Branch">{bank.branch}</DetailRow>}
            {bank.routingNumber && (
              <DetailRow label="Routing number" mono>
                {bank.routingNumber}
              </DetailRow>
            )}
            {bank.mobileWallet && (
              <DetailRow label="Mobile wallet" mono>
                {bank.mobileWallet}
              </DetailRow>
            )}
          </DetailCard>
        )}

        {a.activity.length > 0 && (
          <DetailCard title="Notes">
            {a.activity.map((n, i) => (
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
