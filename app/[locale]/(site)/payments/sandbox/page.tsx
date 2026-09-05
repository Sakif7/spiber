import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { SandboxGateway } from "@/components/shop/sandbox-gateway";
import { formatBDT } from "@/lib/money";

export const dynamic = "force-dynamic";

/** Never let a sandbox page be indexed, and never let it exist in production. */
export const metadata = { robots: { index: false, follow: false } };

/**
 * The page the sandbox gateway redirects to. Exists only so the online payment
 * flow can be exercised without a merchant account; the real gateway hosts its
 * own equivalent.
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

  const str = (v: string | string[] | undefined) =>
    typeof v === "string" ? v : "";
  const orderNumber = str(q.order);
  const amountMinor = Number(str(q.amount));
  const returnUrl = str(q.returnUrl) || `/${locale}`;
  const cancelUrl = str(q.cancelUrl) || returnUrl;

  if (!orderNumber || !Number.isFinite(amountMinor)) notFound();

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <SandboxGateway
        orderNumber={orderNumber}
        amountMinor={amountMinor}
        amountLabel={formatBDT(amountMinor)}
        returnUrl={returnUrl}
        cancelUrl={cancelUrl}
      />
    </div>
  );
}
