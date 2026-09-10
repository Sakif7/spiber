import mongoose, { Schema, type Model, type Types } from "mongoose";
import type {
  SalesOrderStatus,
  SalesPaymentMethod,
} from "@/lib/schemas/sales-order";

/**
 * An offline sale: negotiated with a hospital, quoted on a proposal, invoiced
 * on terms, delivered by hand and paid later.
 *
 * Kept apart from the online `Order` on purpose — the two share only the
 * revenue figures they feed. Documents are stored as immutable VERSIONS rather
 * than re-rendered from the current state, because a client holds a printed
 * copy of what they were sent and it must stay reproducible after an amendment.
 */

export interface ISalesOrderItem {
  id: string;
  /** `inventory` moves real stock; `external` is bought in for this order only. */
  kind: "inventory" | "external";
  productId?: Types.ObjectId | string | null;
  variantId?: string | null;
  sku?: string | null;
  description: string;
  brandOrigin?: string | null;
  specification?: string | null;
  unit?: string | null;
  unitPriceMinor: number;
  /** What the line cost us per unit; null until someone says. */
  unitCostMinor?: number | null;
  /**
   * VAT set against this line, as it was entered: a rate, or a figure.
   *
   * Null on both means nobody touched VAT here. If EVERY line is null the
   * order-level rate applies to the invoice as a whole; the moment one line is
   * set, the order switches to per-line VAT and an untouched line carries
   * none. `priceSalesOrder` owns that rule.
   */
  vatRateBp?: number | null;
  vatAmountMinor?: number | null;
  /** What this line's VAT works out at. Zero unless the order is per-line. */
  vatMinor?: number;
  qty: number;
  lineTotalMinor: number;
  /** How much of this line is currently reserved in inventory. */
  reservedQty: number;
}

/**
 * Tax the buyer keeps back and pays to the government on our behalf.
 *
 * This is never known when the invoice goes out. The client receives the bill,
 * tells us they will withhold (typically 5%), and only then is it recorded —
 * which is why it lives here as its own event rather than as a rate on the
 * order from the start.
 *
 * It is NOT a cost. The money is ours; it sits with the tax office against our
 * income tax and comes back with the certificate. It changes what lands in the
 * bank, not what we earned, and the report keeps those two apart.
 */
export interface ISalesOrderWithholding {
  /** As quoted by the client, in basis points (500 = 5%). */
  aitRateBp: number;
  /** What they actually deducted. */
  aitMinor: number;
  /** VAT deducted at source, where the buyer does that too. */
  vdsMinor?: number | null;
  /** The certificate is what makes it reclaimable, so track whether it came. */
  certificateReceived: boolean;
  certificateRef?: string | null;
  note?: string | null;
  recordedAt: Date;
  recordedBy?: Types.ObjectId | string | null;
}

/**
 * A cost this order carried that no single line did.
 *
 * Getting the goods to the hospital, a courier, an installation charge, a
 * commission — real money spent on this sale that never appeared on an
 * invoice. Without these, "gross profit" is the most flattering number in the
 * business and nobody can say what the job actually made.
 *
 * Free-form on purpose: the label is whatever it was, because the list of
 * things a sale costs is not knowable in advance.
 */
export interface ISalesOrderCost {
  id: string;
  label: string;
  amountMinor: number;
  note?: string | null;
  addedAt: Date;
  addedBy?: Types.ObjectId | string | null;
}

export interface ISalesOrderTerms {
  deliveryDays: number;
  validityDays: number;
  paymentDays: number;
  returnPolicy?: string | null;
}

/** A generated proposal or invoice, frozen at the moment it was produced. */
export interface IDocumentVersion {
  version: number;
  generatedAt: Date;
  generatedBy: Types.ObjectId | string;
  /** Everything the document showed — never re-derived from the live order. */
  snapshot: {
    items: Omit<ISalesOrderItem, "reservedQty">[];
    subtotalMinor: number;
    discountMinor: number;
    deliveryMinor?: number;
    vatRateBp: number;
    vatMinor: number;
    aitRateBp?: number;
    totalMinor: number;
    /** What had been paid when the document was produced. */
    paidMinor?: number;
    referenceNo?: string | null;
    customerId?: string | null;
    terms: ISalesOrderTerms;
    addressee?: {
      title?: string | null;
      dept?: string | null;
      organisation: string;
      address: string;
    };
    subject?: string | null;
    intro?: string | null;
    /**
     * How the quantities were printed on THIS document.
     *
     * A proposal quoted per piece shows a quantity of one on every line while
     * the order behind it holds the real ones. Without this, re-opening the
     * stored proposal reproduces it with the order's quantities — a different
     * document from the one the client was sent.
     */
    quantityMode?: "single" | "ordered" | null;
    invoiceNumber?: string | null;
    invoiceDate?: Date | null;
    deliveryDate?: Date | null;
    challanNumber?: string | null;
    /** Vehicle, driver or courier, as written on the day. */
    dispatchNote?: string | null;
    amountInWords?: string | null;
  };
  /** The filed PDF in the company vault. */
  documentId?: Types.ObjectId | string | null;
  emailedTo: string[];
  emailedAt?: Date | null;
  emailedBy?: Types.ObjectId | string | null;
  /** Set when a later version replaced this one (an amended invoice). */
  supersededAt?: Date | null;
}

export interface ISalesOrderActivity {
  authorId?: Types.ObjectId | string | null;
  body: string;
  at: Date;
  from?: string | null;
  to?: string | null;
}

export interface ISalesOrder {
  number: string;
  leadId: Types.ObjectId | string;
  /** The client as they were when the order was raised. */
  leadSnapshot: {
    organisation: string;
    code: string;
    contactName: string;
    phone: string;
    email?: string | null;
    address: string;
  };
  items: ISalesOrderItem[];
  subtotalMinor: number;
  discountMinor: number;
  /** Transport / delivery billed on top of the goods. Never VAT-able. */
  deliveryMinor: number;
  /** The client's own purchase-order reference, printed on the invoice. */
  referenceNo?: string | null;
  /** Snapshotted when the order is invoiced, so a later rate change is not retroactive. */
  vatRateBp: number;
  vatMinor: number;
  /**
   * The rate we expect the client to withhold at source.
   *
   * Never part of the total. AIT is the buyer's deduction from what they pay
   * us, so adding it to an invoice would overstate what they owe; it prints as
   * a note, and what they actually deducted is recorded on `withholding`.
   */
  aitRateBp?: number;
  totalMinor: number;
  terms: ISalesOrderTerms;
  /** Set once the client tells us what they are keeping back. */
  withholding?: ISalesOrderWithholding | null;
  /** What this sale cost us beyond the goods themselves. */
  costs?: ISalesOrderCost[];
  status: SalesOrderStatus;
  payment: {
    status: "unpaid" | "paid";
    paidAt?: Date | null;
    method?: SalesPaymentMethod | null;
    reference?: string | null;
    note?: string | null;
    recordedBy?: Types.ObjectId | string | null;
  };
  /** The current invoice number; each invoice version keeps its own. */
  invoiceNumber?: string | null;
  invoicedAt?: Date | null;
  deliveredAt?: Date | null;
  proposals: IDocumentVersion[];
  invoices: IDocumentVersion[];
  /**
   * The delivery note that travels with the goods.
   *
   * One number per order, like the invoice: producing it again — to add a
   * vehicle registration, say — is a new version of the same challan, not a
   * second one, because two challans for one delivery is how goods get counted
   * twice at a hospital's gate.
   */
  challans?: IDocumentVersion[];
  challanNumber?: string | null;
  activity: ISalesOrderActivity[];
  note?: string | null;
  createdBy: Types.ObjectId | string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<ISalesOrderItem>(
  {
    id: { type: String, required: true },
    kind: { type: String, enum: ["inventory", "external"], required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", default: null },
    variantId: { type: String, default: null },
    sku: { type: String, default: null },
    description: { type: String, required: true },
    brandOrigin: { type: String, default: null },
    specification: { type: String, default: null },
    unit: { type: String, default: null },
    unitPriceMinor: { type: Number, required: true, min: 0 },
    // Null, not 0: "nobody has told us" and "it was free" are different, and
    // the report must not book a 100% margin on the first of those.
    unitCostMinor: { type: Number, default: null, min: 0 },
    vatRateBp: { type: Number, default: null, min: 0, max: 10000 },
    vatAmountMinor: { type: Number, default: null, min: 0 },
    vatMinor: { type: Number, default: 0, min: 0 },
    qty: { type: Number, required: true, min: 1 },
    lineTotalMinor: { type: Number, required: true, min: 0 },
    reservedQty: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const orderCostSchema = new Schema<ISalesOrderCost>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    amountMinor: { type: Number, required: true, min: 0 },
    note: { type: String, default: null },
    addedAt: { type: Date, required: true },
    addedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false },
);

const withholdingSchema = new Schema<ISalesOrderWithholding>(
  {
    aitRateBp: { type: Number, required: true, min: 0, max: 10000 },
    aitMinor: { type: Number, required: true, min: 0 },
    vdsMinor: { type: Number, default: null, min: 0 },
    certificateReceived: { type: Boolean, default: false },
    certificateRef: { type: String, default: null },
    note: { type: String, default: null },
    recordedAt: { type: Date, required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false },
);

const termsSchema = new Schema<ISalesOrderTerms>(
  {
    deliveryDays: { type: Number, default: 2 },
    validityDays: { type: Number, default: 7 },
    paymentDays: { type: Number, default: 45 },
    returnPolicy: { type: String, default: null },
  },
  { _id: false },
);

const versionSchema = new Schema<IDocumentVersion>(
  {
    version: { type: Number, required: true },
    generatedAt: { type: Date, default: Date.now },
    generatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "CompanyDocument",
      default: null,
    },
    emailedTo: { type: [String], default: [] },
    emailedAt: { type: Date, default: null },
    emailedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    supersededAt: { type: Date, default: null },
  },
  { _id: false },
);

const activitySchema = new Schema<ISalesOrderActivity>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    body: { type: String, required: true },
    at: { type: Date, default: Date.now },
    from: { type: String, default: null },
    to: { type: String, default: null },
  },
  { _id: false },
);

const salesOrderSchema = new Schema<ISalesOrder>(
  {
    number: { type: String, required: true, unique: true },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "SalesLead",
      required: true,
      index: true,
    },
    leadSnapshot: {
      organisation: { type: String, required: true },
      code: { type: String, required: true },
      contactName: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, default: null },
      address: { type: String, required: true },
    },
    items: { type: [itemSchema], default: [] },
    subtotalMinor: { type: Number, default: 0 },
    discountMinor: { type: Number, default: 0 },
    deliveryMinor: { type: Number, default: 0 },
    referenceNo: { type: String, default: null, trim: true },
    vatRateBp: { type: Number, default: 0 },
    vatMinor: { type: Number, default: 0 },
    aitRateBp: { type: Number, default: 0, min: 0, max: 10000 },
    totalMinor: { type: Number, default: 0 },
    terms: { type: termsSchema, default: () => ({}) },
    withholding: { type: withholdingSchema, default: null },
    costs: { type: [orderCostSchema], default: [] },
    status: { type: String, required: true, default: "draft", index: true },
    payment: {
      status: { type: String, enum: ["unpaid", "paid"], default: "unpaid" },
      paidAt: { type: Date, default: null },
      method: { type: String, default: null },
      reference: { type: String, default: null },
      note: { type: String, default: null },
      recordedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    },
    invoiceNumber: { type: String, default: null },
    invoicedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    proposals: { type: [versionSchema], default: [] },
    invoices: { type: [versionSchema], default: [] },
    challans: { type: [versionSchema], default: [] },
    challanNumber: { type: String, default: null },
    activity: { type: [activitySchema], default: [] },
    note: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    deletedAt: { type: Date, default: null },
  },
  { collection: "sales_orders", timestamps: true },
);

salesOrderSchema.index({ deletedAt: 1, status: 1, createdAt: -1 });
// Revenue: paid orders in a date window (see revenue.repo).
salesOrderSchema.index({ "payment.status": 1, "payment.paidAt": 1 });
// An invoice number identifies one order, and is never reused.
salesOrderSchema.index(
  { invoiceNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { invoiceNumber: { $type: "string" } },
  },
);

export const SalesOrder: Model<ISalesOrder> =
  (mongoose.models.SalesOrder as Model<ISalesOrder>) ??
  mongoose.model<ISalesOrder>("SalesOrder", salesOrderSchema);
