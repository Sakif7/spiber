import { connectToDatabase } from "@/lib/db/connect";
import { type ILicense } from "@/lib/models/license";
import {
  getLicenseById,
  setLicenseStatus,
} from "@/lib/repositories/licenses.repo";
import { LICENSE_TRANSITIONS, type LicenseStatus } from "@/lib/schemas/systems";

export type LicenseUpdateResult =
  | { ok: true; license: ILicense }
  | { ok: false; code: "not_found" | "invalid_transition" };

/** Admin license status change (revoke / reactivate), validated by the state machine. */
export async function updateLicenseStatus(
  id: string,
  to: LicenseStatus,
): Promise<LicenseUpdateResult> {
  await connectToDatabase();
  const license = await getLicenseById(id);
  if (!license) return { ok: false, code: "not_found" };
  if (
    license.status !== to &&
    !LICENSE_TRANSITIONS[license.status].includes(to)
  ) {
    return { ok: false, code: "invalid_transition" };
  }
  const updated = await setLicenseStatus(id, to);
  return { ok: true, license: updated!.toObject() };
}
