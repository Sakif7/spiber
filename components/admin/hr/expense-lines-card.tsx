import { DetailCard, DetailRow } from "@/components/admin/ui/detail";
import { formatBDT } from "@/lib/money";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/hr/expense-constants";
import { expenseLinesOf, type ClaimLike } from "@/lib/hr/expense-lines";

/**
 * A claim's bill, line by line, with its total. The office's claim page and
 * the employee's own show the same card; only the date format is theirs.
 */
export function ExpenseLinesCard({
  claim,
  formatDay,
}: {
  claim: ClaimLike;
  formatDay: (d: Date | string) => string;
}) {
  const lines = expenseLinesOf(claim);
  return (
    <DetailCard
      title="Lines"
      description={
        lines.length === 1
          ? "One cost on this bill."
          : `${lines.length} costs on this bill, approved and paid back together.`
      }
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground border-b text-left text-xs">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Note</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {lines.map((l, i) => (
              <tr key={i}>
                <td className="px-4 py-2 whitespace-nowrap">
                  {formatDay(l.spentAt)}
                </td>
                <td className="px-4 py-2">
                  {EXPENSE_CATEGORY_LABEL[l.category] ?? l.category}
                </td>
                <td className="text-muted-foreground px-4 py-2">
                  {l.description || "—"}
                </td>
                <td className="px-4 py-2 text-right font-mono text-xs whitespace-nowrap">
                  {formatBDT(l.amountMinor, "en")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-border grid gap-1 border-t px-4 pt-3 text-sm">
        <DetailRow label="Total" mono>
          <strong>{formatBDT(claim.amountMinor, "en")}</strong>
        </DetailRow>
      </div>
    </DetailCard>
  );
}
