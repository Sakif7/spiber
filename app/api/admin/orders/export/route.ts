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
    [
      "Order",
      "Date",
      "Store",
      "Email",
      "Status",
      "Payment",
      "Method",
      "Due",
      "VAT (BDT)",
      "Total (BDT)",
      "Items",
    ],
  ];
  for (const o of items) {
    rows.push([
      o.orderNumber,
      new Date(o.createdAt).toISOString(),
      o.storefront === "instruments" ? "Medtrade" : "Spiber Kart",
      o.email,
      o.status,
      o.payment.status,
      o.payment.method ?? "offline",
      o.payment.dueAt ? new Date(o.payment.dueAt).toISOString() : "",
      String(fromMinor(o.taxMinor ?? 0)),
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
