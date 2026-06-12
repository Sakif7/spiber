import { setRequestLocale } from "next-intl/server";
import { listCoupons } from "@/lib/repositories/coupons.repo";
import { formatBDT } from "@/lib/money";
import { CouponForm } from "@/components/admin/coupon-form";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ locale: string }> };

type CouponRow = {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  minSubtotalMinor: number | null;
  usageLimit: number | null;
  usedCount: number;
  expiresAt: string | null;
  active: boolean;
};

async function loadCoupons(): Promise<CouponRow[]> {
  try {
    const coupons = await listCoupons();
    return coupons.map((c) => ({
      id: String(c._id),
      code: c.code,
      type: c.type,
      value: c.value,
      minSubtotalMinor:
        typeof c.minSubtotalMinor === "number" ? c.minSubtotalMinor : null,
      usageLimit: typeof c.usageLimit === "number" ? c.usageLimit : null,
      usedCount: c.usedCount ?? 0,
      expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString() : null,
      active: Boolean(c.active),
    }));
  } catch {
    return [];
  }
}

function valueLabel(c: CouponRow): string {
  return c.type === "percent" ? `${c.value}%` : formatBDT(c.value);
}

export default async function CouponsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const coupons = await loadCoupons();

  const columns: Column<CouponRow>[] = [
    {
      key: "code",
      header: "Code",
      cell: (c) => (
        <span className="text-primary font-mono text-xs font-medium">
          {c.code}
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (c) => <span className="capitalize">{c.type}</span>,
    },
    { key: "value", header: "Value", cell: (c) => valueLabel(c) },
    {
      key: "minSubtotal",
      header: "Min subtotal",
      cell: (c) =>
        c.minSubtotalMinor === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          formatBDT(c.minSubtotalMinor)
        ),
    },
    {
      key: "usage",
      header: "Used / Limit",
      cell: (c) =>
        `${c.usedCount} / ${c.usageLimit === null ? "∞" : c.usageLimit}`,
    },
    {
      key: "expires",
      header: "Expires",
      cell: (c) =>
        c.expiresAt ? (
          new Date(c.expiresAt).toLocaleDateString("en-US")
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "active",
      header: "Active",
      cell: (c) => (
        <StatusBadge>{c.active ? "Active" : "Inactive"}</StatusBadge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Coupons"
        description="Manage discount codes applied at checkout."
      />

      <DataTable
        columns={columns}
        rows={coupons}
        getRowKey={(c) => c.id}
        empty="No coupons yet. Create one below."
        minWidth={720}
      />

      <section
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--r-lg)",
          padding: "var(--s-6)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-lg)",
            color: "var(--color-text-strong)",
            margin: "0 0 var(--s-4)",
          }}
        >
          New coupon
        </h2>
        <CouponForm />
      </section>
    </div>
  );
}
