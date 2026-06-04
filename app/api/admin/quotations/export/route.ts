import { requireAdmin } from "@/lib/auth/guard";
import { listQuotations } from "@/lib/repositories/quotations.repo";
import { fromMinor } from "@/lib/money";

function cell(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Exports the most recent 200 quotation requests.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return new Response("Forbidden", { status: 403 });

  const { items } = await listQuotations({ pageSize: 200 });
  const rows: string[][] = [
    [
      "Reference",
      "Date",
      "Name",
      "Email",
      "Organization",
      "District",
      "Items",
      "Status",
      "Quoted (BDT)",
    ],
  ];
  for (const q of items) {
    rows.push([
      q.quotationNumber,
      new Date(q.createdAt).toISOString(),
      q.contact.name,
      q.contact.email,
      q.contact.organization ?? "",
      q.deliveryLocation.district,
      String(q.items.length),
      q.status,
      q.quote?.amountMinor != null
        ? String(fromMinor(q.quote.amountMinor))
        : "",
    ]);
  }
  const csv = rows.map((r) => r.map(cell).join(",")).join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="quotations.csv"',
    },
  });
}
