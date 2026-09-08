import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { EmployeeForm } from "@/components/admin/hr/employee-form";

export const dynamic = "force-dynamic";

export default async function NewEmployeePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="grid gap-6">
      <Link
        href="/admin/company/people/employees"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="size-4" />
        Back to employees
      </Link>
      <h1 className="text-foreground text-2xl font-bold tracking-tight">
        Add employee
      </h1>
      <EmployeeForm />
    </div>
  );
}
