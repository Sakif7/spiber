import { getSetting, setSetting } from "@/lib/repositories/settings.repo";

const KEY = "seller";

/** Platform default commission on seller sales — 10% (1000 basis points). */
export const DEFAULT_COMMISSION_BP = 1000;

type SellerSettings = { commissionBp?: number };

/** Global default commission rate (basis points). Super-admin editable. */
export async function getSellerCommissionBp(): Promise<number> {
  const stored = await getSetting<SellerSettings>(KEY);
  const bp = stored?.commissionBp;
  return typeof bp === "number" && bp >= 0 && bp <= 10000
    ? bp
    : DEFAULT_COMMISSION_BP;
}

export async function setSellerCommissionBp(commissionBp: number) {
  await setSetting(KEY, { commissionBp });
}
