import { requireAdmin } from "@/lib/auth/guard";
import { listOrders } from "@/lib/repositories/orders.repo";
import { fromMinor } from "@/lib/money";

function cell(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Exports the most recent 100 orders (Phase 1 cap).
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return new Response("Forbidden", { status: 403 });

  const { items } = await listOrders({ pageSize: 100 });
  const rows: string[][] = [
    ["Order", "Date", "Email", "Status", "Payment", "Total (BDT)", "Items"],
  ];
  for (const o of items) {
    rows.push([
      o.orderNumber,
      new Date(o.createdAt).toISOString(),
      o.email,
      o.status,
      o.payment.status,
      String(fromMinor(o.totalMinor)),
      String(o.items.length),
    ]);
  }
  const csv = rows.map((r) => r.map(cell).join(",")).join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="orders.csv"',
    },
  });
}
