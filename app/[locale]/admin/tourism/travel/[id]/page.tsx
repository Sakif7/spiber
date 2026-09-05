import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { TravelActions } from "@/components/admin/travel-actions";
import { getTravelRequestByIdLean } from "@/lib/repositories/travelRequests.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { formatBDT } from "@/lib/money";
import { EditorHeader } from "@/components/admin/ui/form-shell";
import {
  DetailCard,
  DetailLayout,
  DetailProse,
  DetailRow,
} from "@/components/admin/ui/detail";
import { StatusBadge } from "@/components/admin/ui/status-badge";

export const dynamic = "force-dynamic";

export default async function AdminTravelDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const r = await getTravelRequestByIdLean(id).catch(() => null);
  if (!r) notFound();
  const user = await getSessionUser();
  const assignedToMe = Boolean(
    user && r.assignedTo && String(r.assignedTo) === user.sub,
  );

  const details = Object.entries(r.details ?? {});

  return (
    <div className="space-y-4">
      <EditorHeader
        backHref="/admin/tourism/travel"
        backLabel="Travel"
        title={r.travelRequestNumber}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{r.type}</span>
            <StatusBadge>{r.status}</StatusBadge>
            <span className="font-mono text-xs">
              {new Date(r.createdAt).toLocaleString()}
            </span>
          </span>
        }
      />

      <DetailLayout
        aside={
          <TravelActions
            travelRequestId={String(r._id)}
            status={r.status}
            currentUserId={user?.sub ?? ""}
            assignedToMe={assignedToMe}
          />
        }
      >
        <DetailCard>
          <DetailRow label="Contact">{r.contact.name}</DetailRow>
          <DetailRow label="Email">{r.contact.email}</DetailRow>
          <DetailRow label="Phone">{r.contact.phone}</DetailRow>
          <DetailRow label="Provider">{r.provider}</DetailRow>
        </DetailCard>

        <DetailCard title="Request details">
          {details.length === 0 ? (
            <p className="text-muted-foreground">No details provided.</p>
          ) : (
            details.map(([k, v]) => (
              <DetailRow
                key={k}
                label={<span className="capitalize">{k}</span>}
              >
                {String(v)}
              </DetailRow>
            ))
          )}
        </DetailCard>

        {r.quote?.amountMinor != null && (
          <DetailCard title="Quote">
            <DetailRow label="Amount">
              {formatBDT(r.quote.amountMinor)}
            </DetailRow>
            {r.quote.note && <DetailProse>{r.quote.note}</DetailProse>}
          </DetailCard>
        )}

        {r.activity.length > 0 && (
          <DetailCard
            title="Activity"
            bodyClassName="divide-border/60 gap-0 divide-y py-0"
          >
            {r.activity.map((n, i) => (
              <div key={i} className="grid gap-0.5 py-2.5">
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
