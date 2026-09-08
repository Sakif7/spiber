import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { getEmployee, listRates } from "@/lib/services/hr/employee.service";
import { rateLabel } from "@/lib/hr/payroll-math";
import { monthLabel } from "@/lib/hr/months";
import { EmployeeForm } from "@/components/admin/hr/employee-form";
import { RateHistory } from "@/components/admin/hr/rate-history";
import {
  DetailLayout,
  DetailCard,
  DetailRow,
} from "@/components/admin/ui/detail";

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
  const rates = await listRates(id);

  const iso = (d?: Date | null) =>
    d ? new Date(d).toISOString().slice(0, 10) : "";

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
            <RateHistory
              employeeId={id}
              payScheme={employee.payScheme}
              rates={rates.map((r) => ({
                rateLabel: `${rateLabel(r.rateBp)}%`,
                effectiveFrom: r.effectiveFrom,
                effectiveLabel: monthLabel(r.effectiveFrom),
                note: r.note ?? null,
                addedAt: new Date(r.createdAt).toLocaleDateString(),
              }))}
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
          employee={{
            id,
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
          }}
        />
      </DetailLayout>
    </div>
  );
}
