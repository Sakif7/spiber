import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { MedicalCase, type IMedicalCase } from "@/lib/models/medicalCase";
import { TravelRequest, type ITravelRequest } from "@/lib/models/travelRequest";
import type { ITourismPayment, Lean } from "@/lib/models/_shared";
import type { TravelRequestType } from "@/lib/schemas/travel-request";

/**
 * Money on a tourism quote: a medical case or a travel request. Both carry the
 * same three things — what the quote collects online, the payment once it is
 * taken, what we pass on — so they are read and written here as one shape.
 */

export type TourismKind = "medical_case" | "travel_request";

export const TOURISM_KINDS: readonly TourismKind[] = [
  "medical_case",
  "travel_request",
];

export const isTourismKind = (k: string): k is TourismKind =>
  (TOURISM_KINDS as readonly string[]).includes(k);

/**
 * Where a quote can still be paid. A case keeps taking its payment while it is
 * being arranged and treated; a lost or closed one, or a cancelled request,
 * takes nothing — money arriving then goes back.
 */
export const TOURISM_PAYABLE: Record<TourismKind, readonly string[]> = {
  medical_case: [
    "quoted",
    "confirmed",
    "arranging",
    "in_treatment",
    "follow_up",
  ],
  travel_request: ["quoted", "confirmed"],
};

const TRAVEL_LABEL: Record<TravelRequestType, string> = {
  air: "Air ticket request",
  hotel: "Hotel request",
  visa: "Visa assistance request",
  transfer: "Airport transfer request",
};

/** What a pay link, the books and the pages need from either record. */
export type TourismSubject = {
  kind: TourismKind;
  id: mongoose.Types.ObjectId;
  /** The case or request number. */
  ref: string;
  status: string;
  quoteMinor: number | null;
  collectOnlineMinor: number | null;
  payment: ITourismPayment | null;
  passedOnMinor: number | null;
  customer: { name: string; email: string; phone: string };
  /** "Medical case", "Air ticket request", … */
  label: string;
  /** The requested service, when the patient named one. */
  detail: string | null;
  /** Where the admin opens it. */
  adminHref: string;
  createdAt: Date;
};

function fromCase(c: Lean<IMedicalCase>): TourismSubject {
  return {
    kind: "medical_case",
    id: c._id,
    ref: c.caseNumber,
    status: c.status,
    quoteMinor: c.quotation?.amountMinor ?? null,
    collectOnlineMinor: c.quotation?.collectOnlineMinor ?? null,
    payment: c.payment ?? null,
    passedOnMinor: c.passedOnMinor ?? null,
    customer: {
      name: c.patient.name,
      email: c.patient.email,
      phone: c.patient.phone,
    },
    label: "Medical case",
    detail: c.requestedService ?? null,
    adminHref: `/admin/tourism/cases/${String(c._id)}`,
    createdAt: c.createdAt,
  };
}

function fromRequest(r: Lean<ITravelRequest>): TourismSubject {
  return {
    kind: "travel_request",
    id: r._id,
    ref: r.travelRequestNumber,
    status: r.status,
    quoteMinor: r.quote?.amountMinor ?? null,
    collectOnlineMinor: r.quote?.collectOnlineMinor ?? null,
    payment: r.payment ?? null,
    passedOnMinor: r.passedOnMinor ?? null,
    customer: {
      name: r.contact.name,
      email: r.contact.email,
      phone: r.contact.phone,
    },
    label: TRAVEL_LABEL[r.type] ?? "Travel request",
    detail: null,
    adminHref: `/admin/tourism/travel/${String(r._id)}`,
    createdAt: r.createdAt,
  };
}

export async function loadTourismSubject(
  kind: TourismKind,
  id: string,
): Promise<TourismSubject | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectToDatabase();
  if (kind === "medical_case") {
    const c = await MedicalCase.findOne({ _id: id, deletedAt: null })
      .lean<Lean<IMedicalCase>>()
      .exec();
    return c ? fromCase(c) : null;
  }
  const r = await TravelRequest.findOne({ _id: id, deletedAt: null })
    .lean<Lean<ITravelRequest>>()
    .exec();
  return r ? fromRequest(r) : null;
}

const modelOf = (kind: TourismKind) =>
  (kind === "medical_case" ? MedicalCase : TravelRequest) as unknown as
    | mongoose.Model<IMedicalCase>
    | mongoose.Model<ITravelRequest>;

const activityEntry = (body: string, actorId?: string | null) => ({
  authorId:
    actorId && mongoose.isValidObjectId(actorId)
      ? new mongoose.Types.ObjectId(actorId)
      : null,
  body,
  at: new Date(),
});

/**
 * Record the quote's online payment — only while it can still be paid (a
 * payable status, not paid already), in one conditional write with its history
 * line. False: the money came too late or twice and must go back.
 */
export async function recordTourismPayment(
  kind: TourismKind,
  id: string,
  payment: ITourismPayment,
  body: string,
): Promise<boolean> {
  if (!mongoose.isValidObjectId(id)) return false;
  await connectToDatabase();
  const res = await (modelOf(kind) as mongoose.Model<IMedicalCase>)
    .updateOne(
      {
        _id: id,
        deletedAt: null,
        status: { $in: [...TOURISM_PAYABLE[kind]] },
        "payment.status": { $ne: "paid" },
      } as Record<string, unknown>,
      { $set: { payment }, $push: { activity: activityEntry(body) } },
    )
    .exec();
  return res.modifiedCount === 1;
}

/** A paid quote is a confirmed one: quoted → confirmed, if still quoted. */
export async function confirmIfQuoted(
  kind: TourismKind,
  id: string,
  body: string,
): Promise<boolean> {
  await connectToDatabase();
  const res = await (modelOf(kind) as mongoose.Model<IMedicalCase>)
    .updateOne({ _id: id, status: "quoted" } as Record<string, unknown>, {
      $set: { status: "confirmed" },
      $push: { activity: activityEntry(body) },
    })
    .exec();
  return res.modifiedCount === 1;
}

/** Staff type what was passed on to the hospital / airline — the cost. */
export async function setTourismPassedOn(
  kind: TourismKind,
  id: string,
  passedOnMinor: number | null,
  body: string,
  actorId: string,
): Promise<boolean> {
  if (!mongoose.isValidObjectId(id)) return false;
  await connectToDatabase();
  const res = await (modelOf(kind) as mongoose.Model<IMedicalCase>)
    .updateOne({ _id: id, deletedAt: null } as Record<string, unknown>, {
      $set: { passedOnMinor },
      $push: { activity: activityEntry(body, actorId) },
    })
    .exec();
  return res.matchedCount === 1;
}

export async function addTourismActivity(
  kind: TourismKind,
  id: string,
  body: string,
  actorId?: string | null,
): Promise<void> {
  await connectToDatabase();
  await (modelOf(kind) as mongoose.Model<IMedicalCase>)
    .updateOne({ _id: id } as Record<string, unknown>, {
      $push: { activity: activityEntry(body, actorId) },
    })
    .exec();
}
