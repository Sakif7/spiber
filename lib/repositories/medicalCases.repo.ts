import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import {
  MedicalCase,
  type IMedicalCase,
  type IMedicalCaseDocument,
  type IMedicalCaseQuotation,
} from "@/lib/models/medicalCase";
import type { Lean } from "@/lib/models/_shared";
import type {
  ChecklistKey,
  MedicalCaseStatus,
} from "@/lib/schemas/medical-case";
import {
  applyDateRange,
  applyPartialSearch,
  paginate,
  sortSpec,
  type RepoListQuery,
} from "./list-query";

type Filter = NonNullable<Parameters<typeof MedicalCase.countDocuments>[0]>;

export async function createMedicalCase(data: Partial<IMedicalCase>) {
  await connectToDatabase();
  return MedicalCase.create(data);
}

/** Mutable doc (for the service to mutate + save). */
export async function getMedicalCaseById(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return MedicalCase.findOne({ _id: id, deletedAt: null }).exec();
}

export async function getMedicalCaseByIdLean(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return MedicalCase.findOne({ _id: id, deletedAt: null })
    .lean<Lean<IMedicalCase>>()
    .exec();
}

/** Guest lookup by reference + email (case-insensitive email). */
export async function getMedicalCaseByNumber(
  caseNumber: string,
  email: string,
) {
  await connectToDatabase();
  return MedicalCase.findOne({
    caseNumber,
    "patient.email": email.trim().toLowerCase(),
    deletedAt: null,
  })
    .lean<Lean<IMedicalCase>>()
    .exec();
}

/** Sort keys the admin list exposes → stored fields. */
const CASE_SORT: Record<string, string> = {
  date: "createdAt",
  number: "caseNumber",
  patient: "patient.name",
  status: "status",
  quoted: "quotation.amountMinor",
};

export type MedicalCaseListParams = RepoListQuery & {
  status?: MedicalCaseStatus;
  assignedTo?: string;
};

export async function listMedicalCases(params: MedicalCaseListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  if (params.assignedTo && mongoose.isValidObjectId(params.assignedTo)) {
    q.assignedTo = params.assignedTo;
  }
  applyPartialSearch(q, params.search, [
    "caseNumber",
    "patient.name",
    "patient.email",
    "patient.country",
  ]);
  applyDateRange(q, params.from, params.to);
  return paginate<IMedicalCase>(MedicalCase, q, {
    sort: sortSpec(params.sort, params.dir, CASE_SORT),
    page: params.page,
    pageSize: params.pageSize ?? 50,
    maxPageSize: 200,
  });
}

export async function listMedicalCasesByUser(userId: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(userId)) return [];
  return MedicalCase.find({ userId, deletedAt: null })
    .sort({ createdAt: -1 })
    .lean<Lean<IMedicalCase>[]>()
    .exec();
}

/** Open (not closed/lost) case count for the dashboard KPI. */
export async function countOpenMedicalCases(): Promise<number> {
  await connectToDatabase();
  return MedicalCase.countDocuments({
    deletedAt: null,
    status: { $nin: ["closed", "lost"] },
  } as unknown as Filter);
}

export async function addMedicalCaseNote(
  id: string,
  authorId: string,
  body: string,
) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return MedicalCase.findByIdAndUpdate(
    id,
    {
      $push: {
        activity: {
          authorId: new mongoose.Types.ObjectId(authorId),
          body,
          at: new Date(),
        },
      },
    },
    { new: true },
  ).exec();
}

export async function setMedicalCaseAssignee(
  id: string,
  assignedTo: string | null,
) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return MedicalCase.findByIdAndUpdate(
    id,
    { assignedTo: assignedTo ? new mongoose.Types.ObjectId(assignedTo) : null },
    { new: true },
  ).exec();
}

export async function pushMedicalCaseDocument(
  id: string,
  doc: IMedicalCaseDocument,
) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return MedicalCase.findByIdAndUpdate(
    id,
    { $push: { documents: doc } },
    { new: true },
  ).exec();
}

export async function setMedicalCaseChecklistItem(
  id: string,
  key: ChecklistKey,
  done: boolean,
  note: string | undefined,
) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  const set: Record<string, unknown> = {
    [`arrangementChecklist.${key}.done`]: done,
  };
  if (note !== undefined) set[`arrangementChecklist.${key}.note`] = note;
  return MedicalCase.findByIdAndUpdate(id, { $set: set }, { new: true }).exec();
}

export async function setMedicalCaseQuotation(
  id: string,
  quotation: IMedicalCaseQuotation,
) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return MedicalCase.findByIdAndUpdate(
    id,
    { $set: { quotation } },
    { new: true },
  ).exec();
}
