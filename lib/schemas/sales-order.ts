import { z } from "zod";

/**
 * Offline sales orders: the quotation → proposal → invoice → delivery flow the
 * company runs on paper today.
 *
 * Deliberately separate from the online `Order`. The two share nothing but the
 * revenue figures they feed: an online order is paid at checkout and shipped,
 * while a sales order is negotiated, invoiced on terms, delivered by hand and
 * paid weeks later.
 */
export const salesOrderStatusEnum = z.enum([
  "draft",
  "proposal_generated",
  "proposal_returned",
  "invoiced",
  "delivered",
  "cancelled",
]);
export type SalesOrderStatus = z.infer<typeof salesOrderStatusEnum>;

/**
 * What each status may become.
 *
 * Reverting is deliberately possible: a client marks up a printed proposal, so
 * an order goes backwards to be amended more often than it goes forwards in one
 * pass. Only `delivered` and `cancelled` are terminal — goods that came back
 * after delivery are a stock movement, not an order state.
 */
export const SALES_ORDER_TRANSITIONS: Record<
  SalesOrderStatus,
  SalesOrderStatus[]
> = {
  draft: ["proposal_generated", "cancelled"],
  proposal_generated: ["proposal_returned", "draft", "cancelled"],
  proposal_returned: ["invoiced", "proposal_generated", "draft", "cancelled"],
  invoiced: ["delivered", "proposal_returned", "cancelled"],
  delivered: [],
  cancelled: [],
};

export const SALES_ORDER_STATUS_LABEL: Record<SalesOrderStatus, string> = {
  draft: "Draft",
  proposal_generated: "Proposal generated",
  proposal_returned: "Proposal returned",
  invoiced: "Invoiced",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Statuses in which line items may still be edited. */
export const EDITABLE_STATUSES: SalesOrderStatus[] = [
  "draft",
  "proposal_returned",
  // An invoiced order can still be amended; the reservation follows the change.
  "invoiced",
];

export const salesPaymentMethodEnum = z.enum([
  "cash",
  "bank",
  "cheque",
  "other",
]);
export type SalesPaymentMethod = z.infer<typeof salesPaymentMethodEnum>;

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "must be an id");

/**
 * A line on the order.
 *
 * `inventory` lines point at a catalogue product and move real stock.
 * `external` lines are things bought in for this order only: free text, a
 * free-text unit, a manually entered price. They never touch inventory, which
 * is the whole reason for the distinction.
 */
export const salesOrderItemSchema = z
  .object({
    id: z.string().trim().min(1).max(40).optional(),
    kind: z.enum(["inventory", "external"]),
    productId: objectId.nullish(),
    variantId: z.string().trim().max(40).nullish(),
    sku: z.string().trim().max(80).nullish(),
    description: z.string().trim().min(1, "is required").max(300),
    brandOrigin: z.string().trim().max(160).optional().or(z.literal("")),
    specification: z.string().trim().max(300).optional().or(z.literal("")),
    unit: z.string().trim().max(40).optional().or(z.literal("")),
    unitPriceMinor: z.number().int().min(0),
    /**
     * What this line cost us, per unit.
     *
     * Free to type on every line: an inventory pick prefills it from the
     * product, an external item is whatever the supplier charged for this
     * order. Null means nobody has said yet, which the report shows as a gap
     * rather than as free goods.
     */
    unitCostMinor: z.number().int().min(0).nullable().optional(),
    qty: z.number().int().min(1).max(100000),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "inventory" && !v.productId) {
      ctx.addIssue({
        code: "custom",
        path: ["productId"],
        message: "pick a product from inventory",
      });
    }
  });
export type SalesOrderItemInput = z.infer<typeof salesOrderItemSchema>;

/**
 * What the buyer is keeping back.
 *
 * Either figure may be given: a rate is the usual case ("we deduct 5%"), and
 * an explicit amount covers a deduction slip that does not divide cleanly.
 * The service works out whichever was not supplied.
 */
export const withholdingSchema = z
  .object({
    aitRateBp: z.number().int().min(0).max(10000).optional(),
    aitMinor: z.number().int().min(0).optional(),
    vdsMinor: z.number().int().min(0).nullable().optional(),
    certificateReceived: z.boolean().optional(),
    certificateRef: z.string().trim().max(120).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.aitRateBp !== undefined || v.aitMinor !== undefined, {
    message: "give a rate or an amount",
  });
export type WithholdingInput = z.infer<typeof withholdingSchema>;

/** One cost carried by the order as a whole, rather than by a line. */
export const orderCostSchema = z.object({
  id: z.string().trim().max(40).optional(),
  label: z.string().trim().min(1, "give it a name").max(120),
  amountMinor: z.number().int().min(0),
  note: z.string().trim().max(300).optional(),
});
export const orderCostsSchema = z.object({
  costs: z.array(orderCostSchema).max(40),
  /** Why, when this changes a sale that is already invoiced. */
  reason: z.string().trim().max(300).optional(),
});
export type OrderCostsInput = z.infer<typeof orderCostsSchema>;

/** Correcting what a line cost us, after the order has been locked. */
export const amendCostsSchema = z.object({
  lines: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        unitCostMinor: z.number().int().min(0).nullable(),
      }),
    )
    .max(200),
  reason: z.string().trim().min(1, "say why").max(300),
});
export type AmendCostsInput = z.infer<typeof amendCostsSchema>;

export const salesOrderTermsSchema = z.object({
  deliveryDays: z.number().int().min(0).max(365).default(2),
  validityDays: z.number().int().min(0).max(365).default(7),
  paymentDays: z.number().int().min(0).max(365).default(45),
  returnPolicy: z.string().trim().max(500).optional(),
});
export type SalesOrderTerms = z.infer<typeof salesOrderTermsSchema>;

export const salesOrderCreateSchema = z.object({
  leadId: objectId,
  items: z.array(salesOrderItemSchema).max(200).default([]),
  discountMinor: z.number().int().min(0).default(0),
  deliveryMinor: z.number().int().min(0).optional(),
  /** The client's own purchase-order reference, printed on the invoice. */
  referenceNo: z.string().trim().max(60).optional().or(z.literal("")),
  /** Overrides the configured VAT rate for this order; omitted = use settings. */
  vatRateBp: z.number().int().min(0).max(10000).optional(),
  terms: salesOrderTermsSchema.partial().optional(),
  note: z.string().trim().max(2000).optional(),
});
export type SalesOrderCreateInput = z.infer<typeof salesOrderCreateSchema>;

export const salesOrderUpdateSchema = salesOrderCreateSchema
  .omit({ leadId: true })
  .partial();
export type SalesOrderUpdateInput = z.infer<typeof salesOrderUpdateSchema>;

export const salesOrderTransitionSchema = z.object({
  to: salesOrderStatusEnum,
  note: z.string().trim().max(2000).optional(),
});

export const salesOrderPaymentSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("paid"),
    paidAt: z.iso.datetime().optional(),
    method: salesPaymentMethodEnum,
    reference: z.string().trim().max(120).optional().or(z.literal("")),
    note: z.string().trim().max(500).optional().or(z.literal("")),
  }),
  z.object({
    status: z.literal("unpaid"),
    note: z.string().trim().max(500).optional().or(z.literal("")),
  }),
]);
export type SalesOrderPaymentInput = z.infer<typeof salesOrderPaymentSchema>;

/** Fields the admin can set when generating a proposal. */
export const proposalGenerateSchema = z.object({
  addresseeTitle: z.string().trim().max(120).optional().or(z.literal("")),
  addresseeDept: z.string().trim().max(160).optional().or(z.literal("")),
  subject: z.string().trim().max(200).optional().or(z.literal("")),
  intro: z.string().trim().max(1500).optional().or(z.literal("")),
  terms: salesOrderTermsSchema.partial().optional(),
  /**
   * How quantities are shown on the quotation.
   *
   * A proposal quotes a rate, and the client decides how many they want — so
   * the usual thing to send is a per-piece price with a quantity of one, even
   * when the order was drafted with ten. "ordered" prints what was actually
   * entered, for the times the quantity is part of what is being agreed.
   */
  quantityMode: z.enum(["single", "ordered"]).optional(),
});
export type ProposalGenerateInput = z.infer<typeof proposalGenerateSchema>;

/** Fields the admin can set when generating an invoice. */
export const invoiceGenerateSchema = z.object({
  invoiceDate: z.iso.datetime().optional(),
  deliveryDate: z.iso.datetime().optional(),
  paymentDays: z.number().int().min(0).max(365).optional(),
});
export type InvoiceGenerateInput = z.infer<typeof invoiceGenerateSchema>;

export const sendDocumentSchema = z.object({
  to: z.email("must be a valid email"),
  subject: z.string().trim().min(1, "is required").max(200),
  body: z.string().trim().min(1, "is required").max(5000),
  /** Required when `to` is not the lead's stored address. */
  confirmRecipient: z.boolean().optional(),
});
export type SendDocumentInput = z.infer<typeof sendDocumentSchema>;

export function lineTotal(unitPriceMinor: number, qty: number): number {
  return unitPriceMinor * qty;
}

/**
 * VAT applies to the goods after any discount, never to a figure that already
 * includes tax and never to the transport charge.
 */
export function priceSalesOrder(input: {
  items: { unitPriceMinor: number; qty: number }[];
  discountMinor: number;
  vatRateBp: number;
  /** Transport / delivery, billed on top. Optional so existing callers are unchanged. */
  deliveryMinor?: number;
}): {
  subtotalMinor: number;
  discountMinor: number;
  vatMinor: number;
  deliveryMinor: number;
  totalMinor: number;
} {
  const subtotalMinor = input.items.reduce(
    (sum, i) => sum + lineTotal(i.unitPriceMinor, i.qty),
    0,
  );
  const discountMinor = Math.min(input.discountMinor, subtotalMinor);
  const base = subtotalMinor - discountMinor;
  // VAT is charged on the discounted GOODS, never on the delivery charge —
  // the same rule the Medtrade storefront applies to shipping.
  const vatMinor = Math.round((base * input.vatRateBp) / 10000);
  const deliveryMinor = Math.max(0, input.deliveryMinor ?? 0);
  return {
    subtotalMinor,
    discountMinor,
    vatMinor,
    deliveryMinor,
    totalMinor: base + vatMinor + deliveryMinor,
  };
}
