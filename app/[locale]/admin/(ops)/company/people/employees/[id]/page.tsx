import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import {
  allocatedShares,
  getEmployee,
  getSharePool,
  listHoldings,
} from "@/lib/services/hr/employee.service";
import { rateLabel } from "@/lib/hr/payroll-math";
import { holdingPercent } from "@/lib/hr/share-pool";
import { monthLabel, monthOf } from "@/lib/hr/months";
import { EmployeeForm } from "@/components/admin/hr/employee-form";
import { EmployeeAccessCard } from "@/components/admin/hr/employee-access-card";
import { SignatureCard } from "@/components/admin/hr/signature-card";
import { EmailSignatureCard } from "@/components/admin/hr/email-signature-card";
import { defaultEmailSignatureHtml } from "@/lib/mail/signature";
import { RateHistory } from "@/components/admin/hr/rate-history";
import { mailboxForEmployee } from "@/lib/services/hr/employee-access.service";
import { findUserById } from "@/lib/repositories/users.repo";
import { mailClientSettings, mailDomain } from "@/lib/mail/config";
import {
  DetailLayout,
  DetailCard,
  DetailRow,
} from "@/components/admin/ui/detail";
import {
  describeSchedule,
  listSchedules,
} from "@/lib/services/hr/pay-schedule.service";
import {
  listPayouts,
  nextPayoutFor,
  type Payee,
} from "@/lib/services/hr/payout.service";
import {
  addDays,
  dayOf,
  formatDay,
  periodLabel,
  todayKey,
} from "@/lib/hr/cycles";
import { formatBDT } from "@/lib/money";
import { SalaryPaidThrough } from "@/components/admin/hr/salary-paid-through";

export const dynamic = "force-dynamic";

export default async function EmployeePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const employee = await getEmployee(id);
  if (!employee) notFound();
  const [holdings, pool, held, mailbox, login, schedules, next, payouts] =
    await Promise.all([
      listHoldings(id),
      getSharePool(),
      allocatedShares(monthOf(new Date())),
      mailboxForEmployee(id),
      employee.userId
        ? findUserById(String(employee.userId)).catch(() => null)
        : Promise.resolve(null),
      listSchedules().catch(() => []),
      nextPayoutFor(employee as unknown as Payee).catch(() => null),
      listPayouts({ employeeId: id, limit: 5 }).catch(() => []),
    ]);
  const today = todayKey();
  const defaultSchedule = schedules.find((s) => s.isDefault);
  // The last day a payout already paid salary for: "Salary paid up to"
  // cannot be moved back past it.
  const salaryPaidTo = payouts
    .filter((p) => p.status === "paid")
    .flatMap((p) => p.items.filter((i) => i.kind === "salary" && i.to))
    .map((i) => dayOf(new Date(i.to!)))
    .sort()
    .reverse()[0];
  const lastPaidSalaryDay = employee.salaryPaidThrough
    ? addDays(dayOf(new Date(employee.salaryPaidThrough)), -1)
    : null;

  const iso = (d?: Date | null) =>
    d ? new Date(d).toISOString().slice(0, 10) : "";
  const isoFull = (d?: Date | null) => (d ? new Date(d).toISOString() : null);

  return (
    <div className="grid gap-6">
      <Link
        href="/admin/company/people/employees"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="size-4" />
        Back to employees
      </Link>

      <div>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          {employee.name}
        </h1>
        <p className="text-muted-foreground mt-1">
          {employee.designation} · {employee.code}
        </p>
      </div>

      <DetailLayout
        aside={
          <>
            <EmployeeAccessCard
              employeeId={id}
              employeeName={employee.name}
              mailDomain={mailDomain()}
              businessEmail={employee.businessEmail ?? null}
              personalEmail={employee.email ?? null}
              login={login ? { disabled: Boolean(login.disabled) } : null}
              invitedAt={isoFull(employee.invitedAt)}
              inviteAcceptedAt={isoFull(employee.inviteAcceptedAt)}
              mailbox={
                mailbox
                  ? {
                      status: mailbox.status,
                      quotaBytes: mailbox.quotaBytes ?? null,
                      provider: mailbox.provider ?? null,
                      provisionedAt: isoFull(mailbox.provisionedAt),
                      lastError: mailbox.lastError ?? null,
                    }
                  : null
              }
              client={mailClientSettings()}
              activity={(employee.activity ?? []).map((e) => ({
                at: new Date(e.at).toISOString(),
                action: e.action,
                note: e.note ?? null,
              }))}
            />
            <SignatureCard
              endpoint={`/api/admin/company/hr/employees/${id}/signature`}
              imageSrc={`/api/media/signature/${id}`}
              initial={
                employee.signatureAssetId
                  ? { updatedAt: isoFull(employee.signatureUpdatedAt) }
                  : null
              }
            />
            <EmailSignatureCard
              endpoint={`/api/admin/company/hr/employees/${id}/email-signature`}
              initial={
                employee.emailSignature?.html
                  ? {
                      html: employee.emailSignature.html,
                      logo: employee.emailSignature.logo !== false,
                      updatedAt: isoFull(employee.emailSignature.updatedAt),
                    }
                  : null
              }
              fromRecord={defaultEmailSignatureHtml({
                name: employee.name,
                designation: employee.designation,
                phone: employee.phone,
                businessEmail: employee.businessEmail,
              })}
            />
            <DetailCard
              title="Pay"
              description="When they are paid. Shares come from approved profit periods; salary is earned by the day."
            >
              <DetailRow label="Schedule">
                {next ? (
                  <Link
                    href={`/admin/company/people/payouts?schedule=${next.schedule.virtual ? "default" : next.schedule.id}`}
                    className="text-primary hover:underline"
                  >
                    {next.schedule.name}
                  </Link>
                ) : (
                  "—"
                )}
              </DetailRow>
              {next && (
                <>
                  <DetailRow label="Pays">
                    {describeSchedule(next.schedule, today)}
                  </DetailRow>
                  <DetailRow label="This period">
                    {periodLabel(next.period.start, next.period.end)}
                  </DetailRow>
                  <DetailRow label="Payday">{formatDay(next.payday)}</DetailRow>
                  <DetailRow label="Earned so far, unpaid">
                    {formatBDT(next.accruedMinor, "en")}
                  </DetailRow>
                </>
              )}
              {employee.payScheme === "none" && (
                <DetailRow label="Paid by">
                  Not through payroll — only claims
                </DetailRow>
              )}
              {employee.payScheme === "fixed" && (
                <>
                  <DetailRow label="Monthly salary">
                    {employee.fixedMonthlyMinor
                      ? formatBDT(employee.fixedMonthlyMinor, "en")
                      : "Not set"}
                  </DetailRow>
                  <DetailRow label="Salary paid up to">
                    {lastPaidSalaryDay
                      ? formatDay(lastPaidSalaryDay)
                      : "Nothing paid yet"}
                  </DetailRow>
                  <SalaryPaidThrough
                    employeeId={id}
                    through={lastPaidSalaryDay ?? ""}
                    min={salaryPaidTo ? addDays(salaryPaidTo, -1) : null}
                    today={today}
                  />
                </>
              )}
              {payouts.length > 0 && (
                <ul className="grid gap-1 border-t pt-2 text-sm">
                  {payouts.map((p) => (
                    <li
                      key={String(p._id)}
                      className="flex justify-between gap-3"
                    >
                      <Link
                        href={`/admin/company/people/payouts/${String(p._id)}`}
                        className="text-primary truncate hover:underline"
                      >
                        {p.periodLabel}
                      </Link>
                      <span className="text-muted-foreground shrink-0 tabular-nums">
                        {formatBDT(p.totalMinor, "en")}
                        {p.status !== "paid" ? ` · ${p.status}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </DetailCard>
            <RateHistory
              employeeId={id}
              payScheme={employee.payScheme}
              pool={{
                totalShares: pool.totalShares,
                unallocated: Math.max(0, pool.totalShares - held),
              }}
              rates={holdings.map((r) => {
                // A row from before shareholdings carries only a percentage;
                // it is shown as it was until the migration rewrites it.
                const legacy = typeof r.shares !== "number";
                return {
                  label: legacy
                    ? `${rateLabel(r.rateBp ?? 0)}%`
                    : `${(r.shares ?? 0).toLocaleString("en-BD")} shares`,
                  fraction: legacy
                    ? null
                    : `${holdingPercent(r.shares ?? 0, pool.totalShares)}% of the pool`,
                  effectiveFrom: r.effectiveFrom,
                  effectiveLabel: monthLabel(r.effectiveFrom),
                  note: r.note ?? null,
                  addedAt: new Date(r.createdAt).toLocaleDateString(),
                  legacy,
                };
              })}
            />
            {employee.bankDetails?.accountNumber && (
              <DetailCard title="Bank">
                <DetailRow label="Bank">
                  {employee.bankDetails.bankName ?? "—"}
                </DetailRow>
                <DetailRow label="Branch">
                  {employee.bankDetails.branch ?? "—"}
                </DetailRow>
                <DetailRow label="Account">
                  {employee.bankDetails.accountName ?? "—"}
                </DetailRow>
                <DetailRow label="Number" mono>
                  {employee.bankDetails.accountNumber}
                </DetailRow>
              </DetailCard>
            )}
          </>
        }
      >
        <EmployeeForm
          mailDomain={mailDomain()}
          schedules={schedules
            .filter((s) => !s.isDefault)
            .map((s) => ({ value: s.id, label: s.name }))}
          defaultScheduleName={defaultSchedule?.name ?? "Monthly"}
          employee={{
            id,
            businessEmail: employee.businessEmail ?? "",
            name: employee.name,
            designation: employee.designation,
            kind: employee.kind,
            payScheme: employee.payScheme,
            email: employee.email ?? "",
            phone: employee.phone ?? "",
            joinedAt: iso(employee.joinedAt),
            leftAt: iso(employee.leftAt),
            status: employee.status,
            notes: employee.notes ?? "",
            bankName: employee.bankDetails?.bankName ?? "",
            branch: employee.bankDetails?.branch ?? "",
            accountName: employee.bankDetails?.accountName ?? "",
            accountNumber: employee.bankDetails?.accountNumber ?? "",
            routingNumber: employee.bankDetails?.routingNumber ?? "",
            // Following the default reads as the default, whichever way it is stored.
            payScheduleId:
              employee.payScheduleId &&
              String(employee.payScheduleId) !== defaultSchedule?.id
                ? String(employee.payScheduleId)
                : "",
            fixedMonthly: employee.fixedMonthlyMinor
              ? String(employee.fixedMonthlyMinor / 100)
              : "",
          }}
        />
      </DetailLayout>
    </div>
  );
}
