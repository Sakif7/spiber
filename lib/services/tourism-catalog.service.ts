import { connectToDatabase } from "@/lib/db/connect";
import {
  createDestination as repoCreateDestination,
  updateDestination as repoUpdateDestination,
  softDeleteDestination as repoSoftDeleteDestination,
} from "@/lib/repositories/destinations.repo";
import {
  createHospital as repoCreateHospital,
  updateHospital as repoUpdateHospital,
  softDeleteHospital as repoSoftDeleteHospital,
} from "@/lib/repositories/hospitals.repo";
import {
  createDoctor as repoCreateDoctor,
  updateDoctor as repoUpdateDoctor,
  softDeleteDoctor as repoSoftDeleteDoctor,
} from "@/lib/repositories/doctors.repo";
import {
  createPackage as repoCreatePackage,
  updatePackage as repoUpdatePackage,
  softDeletePackage as repoSoftDeletePackage,
} from "@/lib/repositories/packages.repo";
import type {
  DestinationCreateInput,
  DestinationUpdateInput,
  DoctorCreateInput,
  DoctorUpdateInput,
  HospitalCreateInput,
  HospitalUpdateInput,
  PackageCreateInput,
  PackageUpdateInput,
} from "@/lib/schemas/tourism-catalog";

export type CatalogWriteResult =
  | { ok: true; id: string }
  | { ok: false; code: "duplicate_slug" };

export type CatalogMutateResult =
  | { ok: true; id: string }
  | { ok: false; code: "not_found" };

/** Mongoose duplicate-key (E11000) — a slug already taken by a live row. */
function isDuplicateKey(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { code?: number }).code === 11000
  );
}

// ----------------------------------------------------------- Destination
export async function createDestinationContent(
  input: DestinationCreateInput,
): Promise<CatalogWriteResult> {
  await connectToDatabase();
  try {
    const doc = await repoCreateDestination(input);
    return { ok: true, id: String(doc._id) };
  } catch (e) {
    if (isDuplicateKey(e)) return { ok: false, code: "duplicate_slug" };
    throw e;
  }
}

export async function updateDestinationContent(
  id: string,
  patch: DestinationUpdateInput,
): Promise<CatalogMutateResult> {
  const updated = await repoUpdateDestination(id, patch);
  return updated ? { ok: true, id } : { ok: false, code: "not_found" };
}

export async function deleteDestinationContent(
  id: string,
): Promise<CatalogMutateResult> {
  const deleted = await repoSoftDeleteDestination(id);
  return deleted ? { ok: true, id } : { ok: false, code: "not_found" };
}

// -------------------------------------------------------------- Hospital
export async function createHospitalContent(
  input: HospitalCreateInput,
): Promise<CatalogWriteResult> {
  await connectToDatabase();
  try {
    const doc = await repoCreateHospital(input);
    return { ok: true, id: String(doc._id) };
  } catch (e) {
    if (isDuplicateKey(e)) return { ok: false, code: "duplicate_slug" };
    throw e;
  }
}

export async function updateHospitalContent(
  id: string,
  patch: HospitalUpdateInput,
): Promise<CatalogMutateResult> {
  const updated = await repoUpdateHospital(id, patch);
  return updated ? { ok: true, id } : { ok: false, code: "not_found" };
}

export async function deleteHospitalContent(
  id: string,
): Promise<CatalogMutateResult> {
  const deleted = await repoSoftDeleteHospital(id);
  return deleted ? { ok: true, id } : { ok: false, code: "not_found" };
}

// ---------------------------------------------------------------- Doctor
export async function createDoctorContent(
  input: DoctorCreateInput,
): Promise<CatalogWriteResult> {
  await connectToDatabase();
  try {
    const doc = await repoCreateDoctor(input);
    return { ok: true, id: String(doc._id) };
  } catch (e) {
    if (isDuplicateKey(e)) return { ok: false, code: "duplicate_slug" };
    throw e;
  }
}

export async function updateDoctorContent(
  id: string,
  patch: DoctorUpdateInput,
): Promise<CatalogMutateResult> {
  const updated = await repoUpdateDoctor(id, patch);
  return updated ? { ok: true, id } : { ok: false, code: "not_found" };
}

export async function deleteDoctorContent(
  id: string,
): Promise<CatalogMutateResult> {
  const deleted = await repoSoftDeleteDoctor(id);
  return deleted ? { ok: true, id } : { ok: false, code: "not_found" };
}

// ------------------------------------------------------- TreatmentPackage
export async function createPackageContent(
  input: PackageCreateInput,
): Promise<CatalogWriteResult> {
  await connectToDatabase();
  try {
    const doc = await repoCreatePackage(input);
    return { ok: true, id: String(doc._id) };
  } catch (e) {
    if (isDuplicateKey(e)) return { ok: false, code: "duplicate_slug" };
    throw e;
  }
}

export async function updatePackageContent(
  id: string,
  patch: PackageUpdateInput,
): Promise<CatalogMutateResult> {
  const updated = await repoUpdatePackage(id, patch);
  return updated ? { ok: true, id } : { ok: false, code: "not_found" };
}

export async function deletePackageContent(
  id: string,
): Promise<CatalogMutateResult> {
  const deleted = await repoSoftDeletePackage(id);
  return deleted ? { ok: true, id } : { ok: false, code: "not_found" };
}
