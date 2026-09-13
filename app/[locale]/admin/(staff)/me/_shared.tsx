import { redirect } from "next/navigation";
import { requireEmployee, type EmployeeSession } from "@/lib/auth/guard";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { DetailCard } from "@/components/admin/ui/detail";

/**
 * Every portal page starts the same way: an active Employee record behind the
 * login, or an honest card. Kept in one place so the rule cannot drift.
 */
export async function employeeOrRedirect(
  locale: string,
  next: string,
): Promise<EmployeeSession> {
  const session = await requireEmployee();
  if (!session) redirect(`/${locale}?auth=login&next=/${locale}${next}`);
  return session;
}

export function NoEmployeeRecord({ title }: { title: string }) {
  return (
    <div className="space-y-4">
      <AdminPageHeader title={title} />
      <DetailCard title="No employee record">
        <p className="text-muted-foreground">
          Your login is not linked to an active employee record. Ask the office
          to add you on the Employees page with this address as the business
          email.
        </p>
      </DetailCard>
    </div>
  );
}

export const cap = (s: string) =>
  s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export const day = (d: Date | string | null | undefined) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Dhaka",
      })
    : "—";
