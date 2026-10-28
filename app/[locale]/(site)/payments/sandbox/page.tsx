import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { SandboxGateway } from "@/components/shop/sandbox-gateway";
import { devPaymentView } from "@/lib/payments/dev.provider";
import { formatBDT } from "@/lib/money";

export const dynamic = "force-dynamic";

/** Never let a sandbox page be indexed, and never let it exist in production. */
export const metadata = { robots: { index: false, follow: false } };

/**
 * The page the sandbox gateway sends the customer to, playing PayStation's
 * hosted checkout so the whole flow can be walked through offline.
 */
export default async function SandboxPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { locale } = await params;
  setRequestLocale(locale);
  const q = await searchParams;
  const invoice = typeof q.invoice === "string" ? q.invoice : "";
  if (!invoice) notFound();
  const payment = await devPaymentView(invoice).catch(() => null);
  if (!payment) notFound();

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <SandboxGateway
        invoiceNumber={payment.invoiceNumber}
        reference={payment.reference}
        amountLabel={formatBDT(payment.amountMinor)}
        alreadyPaid={payment.state === "paid"}
      />
    </div>
  );
}
