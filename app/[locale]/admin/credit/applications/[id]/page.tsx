import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getCreditApplicationByIdLean } from "@/lib/repositories/credit-applications.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { CreditApplicationActions } from "@/components/admin/credit-application-actions";
import { formatBDT } from "@/lib/money";

export const dynamic = "force-dynamic";

const DOC_LABEL: Record<string, string> = {
  trade_license: "Trade licence",
  tin_certificate: "TIN certificate",
  bin_certificate: "BIN certificate",
  bank_statement: "Bank statement",
  national_id: "National ID",
};

export default async function AdminCreditApplicationPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const app = await getCreditApplicationByIdLean(id).catch(() => null);
  if (!app) notFound();
  const session = await getSessionUser();

  const rows: [string, string][] = [
    ["Organisation", app.organization],
    ...(app.organizationType
      ? ([["Type", app.organizationType]] as [string, string][])
      : []),
    ["Contact", app.contactName],
    ["Email", app.email],
    ...(app.phone ? ([["Phone", app.phone]] as [string, string][]) : []),
    ...(app.address ? ([["Address", app.address]] as [string, string][]) : []),
    ...(app.tradeLicenseNo
      ? ([["Trade licence no.", app.tradeLicenseNo]] as [string, string][])
      : []),
    ...(app.tinNumber ? ([["TIN", app.tinNumber]] as [string, string][]) : []),
    ...(app.binNumber ? ([["BIN", app.binNumber]] as [string, string][]) : []),
    ...(app.expectedMonthlyVolumeMinor
      ? ([
          [
            "Expected monthly volume",
            formatBDT(app.expectedMonthlyVolumeMinor),
          ],
        ] as [string, string][])
      : []),
    [
      "Terms accepted",
      app.termsAcceptedAt
        ? new Date(app.termsAcceptedAt).toLocaleString()
        : "—",
    ],
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/credit/applications"
          className="text-muted-foreground text-sm hover:underline"
        >
          ← Back to credit applications
        </Link>
        <h1 className="text-foreground mt-2 font-[family-name:var(--font-display)] text-2xl">
          {app.organization}
        </h1>
        <p className="text-muted-foreground font-mono text-xs">
          {app.applicationNumber}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-start">
        <div className="space-y-6">
          <section className="bg-card space-y-3 rounded-lg p-5 shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-foreground font-[family-name:var(--font-display)] text-lg">
                Application
              </h2>
              <StatusBadge>{app.status}</StatusBadge>
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-[180px_1fr]">
              {rows.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="m-0">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="text-foreground text-sm whitespace-pre-wrap">
              {app.description}
            </p>
          </section>

          <section className="bg-card space-y-3 rounded-lg p-5 shadow-[var(--shadow-sm)]">
            <h2 className="text-foreground font-[family-name:var(--font-display)] text-lg">
              Verification documents
            </h2>
            {app.documents.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No documents were uploaded.
              </p>
            ) : (
              <ul className="m-0 grid list-none gap-2 p-0 text-sm">
                {app.documents.map((d, i) => (
                  <li
                    key={i}
                    className="border-border flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                  >
                    <span>
                      <strong>{DOC_LABEL[d.label] ?? d.label}</strong>
                      <span className="text-muted-foreground block text-xs">
                        {d.filename}
                      </span>
                    </span>
                    {/* Gated + audited: /api/media/credit-application/[id]/[i] */}
                    <a
                      href={`/api/media/credit-application/${String(app._id)}/${i}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary font-medium hover:underline"
                    >
                      View
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {app.activity.length > 0 ? (
            <section className="bg-card space-y-3 rounded-lg p-5 shadow-[var(--shadow-sm)]">
              <h2 className="text-foreground font-[family-name:var(--font-display)] text-lg">
                Activity
              </h2>
              <ul className="m-0 grid list-none gap-3 p-0 text-sm">
                {app.activity.map((a, i) => (
                  <li
                    key={i}
                    className="border-border border-t pt-2 first:border-0 first:pt-0"
                  >
                    <span className="text-muted-foreground block text-xs">
                      {new Date(a.at).toLocaleString()}
                    </span>
                    {a.body}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <CreditApplicationActions
          applicationId={String(app._id)}
          status={app.status}
          currentUserId={session?.sub ?? ""}
          assignedToMe={
            !!session && String(app.assignedTo ?? "") === session.sub
          }
        />
      </div>
    </div>
  );
}
