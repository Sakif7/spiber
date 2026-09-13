import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { salesReport, receivables } from "@/lib/repositories/sales-report.repo";
import { requireAdmin } from "@/lib/auth/guard";
import { getAdminPrefsRaw } from "@/lib/repositories/users.repo";
import { sanitizeSheetLayout } from "@/lib/admin/sales-sheet";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { SalesReportView } from "@/components/admin/sales/sales-report-view";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

/** Dhaka, because that is the day the business had. */
const TZ = "Asia/Dhaka";

/** The first instant of a Dhaka day, as a real Date. */
const dhakaDay = (ymd: string) => new Date(`${ymd}T00:00:00+06:00`);

const ymd = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

function presets(now: Date) {
  const today = ymd(now);
  const [y, m] = today.split("-").map(Number);
  const first = (yy: number, mm: number) =>
    `${yy}-${String(mm).padStart(2, "0")}-01`;
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  return [
    { label: "This month", from: first(y, m), to: today },
    { label: "Last month", from: first(prevY, prevM), to: first(y, m) },
    { label: "This year", from: `${y}-01-01`, to: today },
  ];
}

export default async function SalesReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;

  const now = new Date();
  const options = presets(now);
  const from = typeof sp.from === "string" ? sp.from : options[0].from;
  // `to` is inclusive to a reader, so the window runs to the START of the
  // following day — otherwise a sale paid this afternoon would be missing from
  // a report that says it covers today.
  const to = typeof sp.to === "string" ? sp.to : options[0].to;
  const end = new Date(dhakaDay(to).getTime() + 86400000);

  const admin = await requireAdmin();
  const [report, unpaid, prefs] = await Promise.all([
    salesReport({ start: dhakaDay(from), end }).catch(() => null),
    receivables(now).catch(() => []),
    admin
      ? getAdminPrefsRaw(admin.sub).catch(() => null)
      : Promise.resolve(null),
  ]);
  // The arrangement this admin last chose for the spreadsheet, or the default.
  const sheetLayout = sanitizeSheetLayout(
    (prefs as { salesSheet?: unknown } | null)?.salesSheet,
  );

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Sales report"
        description="Both storefronts and the sales team, counted when the money arrived."
      />

      <div className="flex flex-wrap items-center gap-2">
        {options.map((o) => {
          const active = from === o.from && to === o.to;
          return (
            <Button
              key={o.label}
              asChild
              size="sm"
              variant={active ? "default" : "outline"}
            >
              <Link
                href={`/admin/company/sales/report?from=${o.from}&to=${o.to}`}
              >
                {o.label}
              </Link>
            </Button>
          );
        })}
        <form className="ml-auto flex items-end gap-2" action="">
          <label className="grid gap-1">
            <span className="text-muted-foreground text-xs">From</span>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-muted-foreground text-xs">To</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            />
          </label>
          <Button size="sm" variant="outline" type="submit">
            Apply
          </Button>
        </form>
      </div>

      <p className={cn("text-muted-foreground text-xs")}>
        Revenue is goods sold excluding VAT, counted on the day payment arrived.
        Cost is what each line cost us, frozen when it sold.
      </p>

      {report ? (
        <SalesReportView
          report={report}
          receivables={unpaid}
          sheetLayout={sheetLayout}
        />
      ) : (
        <p className="text-muted-foreground py-10 text-center">
          The report could not be built. Check the database connection.
        </p>
      )}
    </div>
  );
}
