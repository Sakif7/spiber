import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { PrintButton } from "@/components/academy/print-button";
import { getMedicalCaseByIdLean } from "@/lib/repositories/medicalCases.repo";
import { formatBDT } from "@/lib/money";
import { siteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

/**
 * On-demand, printable treatment quotation — rendered from the case's stored
 * fields (no PDF is stored). The admin/patient prints to PDF via the browser.
 * A scoped @media print rule isolates the sheet from the admin chrome.
 */
export default async function CaseQuotationPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const c = await getMedicalCaseByIdLean(id).catch(() => null);
  if (!c) notFound();
  const q = c.quotation;

  const label: React.CSSProperties = {
    color: "var(--color-text-muted)",
    fontSize: "var(--fs-body-sm)",
  };
  const value: React.CSSProperties = {
    color: "var(--color-text-strong)",
    fontWeight: 600,
    textAlign: "right",
  };
  const row: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    gap: "var(--s-4)",
    padding: "10px 0",
    borderBottom: "1px solid var(--color-border)",
  };

  return (
    <div style={{ display: "grid", gap: "var(--s-5)", maxWidth: 720 }}>
      {/* Print isolation — hide the admin chrome, show only the sheet. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `@media print {
            body * { visibility: hidden !important; }
            #quotation-sheet, #quotation-sheet * { visibility: visible !important; }
            #quotation-sheet { position: absolute; left: 0; top: 0; width: 100%; border: none !important; }
            .no-print { display: none !important; }
          }`,
        }}
      />

      <div
        className="no-print"
        style={{ display: "flex", gap: "var(--s-3)", alignItems: "center" }}
      >
        <Link
          href={`/admin/tourism/cases/${id}`}
          style={{
            color: "var(--color-brand-deep)",
            fontSize: "var(--fs-body-sm)",
          }}
        >
          ← Back to case
        </Link>
        <PrintButton />
      </div>

      <article
        id="quotation-sheet"
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: "var(--r-lg)",
          background: "#fff",
          padding: "clamp(28px, 5vw, 56px)",
          display: "grid",
          gap: "var(--s-5)",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "var(--s-4)",
            borderBottom: "2px solid var(--color-secondary)",
            paddingBottom: "var(--s-4)",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--fs-xl)",
                color: "var(--color-text-strong)",
              }}
            >
              {siteConfig.brand} Tourism
            </div>
            <div style={label}>Treatment quotation</div>
          </div>
          <div style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
            <div style={{ color: "var(--color-text-strong)" }}>
              {c.caseNumber}
            </div>
            <div style={label}>{new Date().toLocaleDateString()}</div>
          </div>
        </header>

        <div>
          <div style={row}>
            <span style={label}>Patient</span>
            <span style={value}>{c.patient.name}</span>
          </div>
          <div style={row}>
            <span style={label}>Country</span>
            <span style={value}>{c.patient.country}</span>
          </div>
          {c.requestedService && (
            <div style={row}>
              <span style={label}>Requested service</span>
              <span style={value}>{c.requestedService}</span>
            </div>
          )}
          <div style={row}>
            <span style={label}>Estimated total</span>
            <span style={{ ...value, fontSize: "var(--fs-lg)" }}>
              {q?.amountMinor != null ? formatBDT(q.amountMinor) : "On request"}
            </span>
          </div>
          {q?.validUntil && (
            <div style={row}>
              <span style={label}>Valid until</span>
              <span style={value}>
                {new Date(q.validUntil).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {q?.notes && (
          <div>
            <div style={{ ...label, marginBottom: 6 }}>What this covers</div>
            <p style={{ margin: 0, whiteSpace: "pre-line" }}>{q.notes}</p>
          </div>
        )}

        <footer
          style={{
            ...label,
            borderTop: "1px solid var(--color-border)",
            paddingTop: "var(--s-4)",
          }}
        >
          This is an estimate in Bangladeshi Taka (BDT). Final costs are
          confirmed by the treating hospital. {siteConfig.brand} Tourism ·{" "}
          {siteConfig.url}
        </footer>
      </article>
    </div>
  );
}
