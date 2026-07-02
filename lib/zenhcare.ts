/**
 * ZenHcare partner integration (affiliate referral model). Spiber Med is a
 * ZenHcare affiliate: ZenHcare is listed as a quote/request-access software
 * product, and its inquiries are forwarded to ZenHcare's affiliate sales API
 * so the lead lands attributed to Spiber. The customer signs up and pays
 * ZenHcare directly; Spiber earns commission on ZenHcare's side. This is the
 * referral path — NOT the reseller purchase/fulfillment seam (lib/fulfillment/).
 *
 * Contract: POST {base}/api/affiliates/sales with an X-App-Key header creates
 * an attributed SalesLead and returns { success, data:{ leadId, status } }.
 */

function apiBase(): string {
  return process.env.ZENHCARE_API_BASE?.trim() || "https://api.zenhcare.com";
}

export type ZenhcareLeadInput = {
  organization: { name: string; type?: string; website?: string };
  contact: {
    name: string;
    email: string;
    phone?: string;
    designation?: string;
  };
  interest?: { plan?: string; billingCycle?: string; message?: string };
};

/**
 * Submit an attributed sales lead to ZenHcare. Attribution comes from the API
 * key — ZenHcare stamps Spiber's affiliate id server-side. Throws when the key
 * is missing or ZenHcare rejects the request; callers treat it as best-effort.
 */
export async function submitZenhcareLead(
  input: ZenhcareLeadInput,
): Promise<{ leadId: string; status: string }> {
  const key = process.env.ZENHCARE_AFFILIATE_API_KEY?.trim();
  if (!key) {
    throw new Error("ZENHCARE_AFFILIATE_API_KEY is not configured");
  }
  const res = await fetch(`${apiBase()}/api/affiliates/sales`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-App-Key": key },
    body: JSON.stringify({
      tenantType: "hospital",
      organization: input.organization,
      contact: input.contact,
      interest: { region: "BD", ...input.interest },
    }),
    signal: AbortSignal.timeout(8_000),
  });
  const json = (await res.json().catch(() => null)) as {
    success?: boolean;
    data?: { leadId?: string; status?: string };
  } | null;
  const leadId = json?.data?.leadId;
  if (!res.ok || !json?.success || !leadId) {
    throw new Error(`ZenHcare lead submission failed (${res.status})`);
  }
  return { leadId, status: json.data?.status ?? "new" };
}
