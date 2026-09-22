import type { SalesOrderStatus } from "@/lib/schemas/sales-order";

/**
 * The sales journey as a person experiences it, which is not quite the status
 * machine.
 *
 * `SALES_ORDER_TRANSITIONS` allows going backwards, because a client marks up a
 * printed proposal and the order is amended. That is correct for the data and
 * useless as a progress indicator: someone looking at the screen needs to know
 * how far along this deal is and what happens next, not the full set of legal
 * moves. So the rail is a fixed forward line, and reverting simply moves the
 * marker back along it.
 *
 * Payment is deliberately NOT a stage. An order can be paid before or after
 * delivery, so it is tracked beside the rail rather than on it.
 */

export type JourneyStage = {
  status: SalesOrderStatus;
  /** What the stage is called on screen. */
  label: string;
  /** What the person does here, in their words. */
  hint: string;
};

export const SALES_JOURNEY: JourneyStage[] = [
  { status: "draft", label: "Draft", hint: "Add the items and prices." },
  {
    status: "proposal_generated",
    label: "Proposal sent",
    hint: "The client has the quotation.",
  },
  {
    status: "proposal_returned",
    label: "Returned",
    hint: "They marked it up. Amend, then invoice.",
  },
  {
    status: "invoiced",
    label: "Invoiced",
    hint: "Stock is reserved for this order.",
  },
  {
    status: "delivered",
    label: "Delivered",
    hint: "Goods have left. Record payment when it arrives.",
  },
];

export type StageState = "done" | "current" | "todo";

/** Where the rail's marker sits, and how each stage before it should read. */
export function stageStates(
  status: SalesOrderStatus,
): { stage: JourneyStage; state: StageState }[] {
  // A cancelled order left the journey; nothing after Draft is true of it.
  const index =
    status === "cancelled"
      ? -1
      : SALES_JOURNEY.findIndex((s) => s.status === status);
  return SALES_JOURNEY.map((stage, i) => ({
    stage,
    state: i < index ? "done" : i === index ? "current" : "todo",
  }));
}

/**
 * The one thing to do next, which becomes the primary button.
 *
 * Everything else an order can do stays available, but in a menu: a screen with
 * eight equal buttons does not tell anyone what to press.
 */
export type NextAction = {
  /** The transition to run, or a document to produce. */
  kind: "proposal" | "invoice" | "transition" | "payment" | "none";
  to?: SalesOrderStatus;
  label: string;
  /** Why this is the next step, shown under the rail. */
  hint: string;
};

/**
 * Is moving from `from` to `to` a step BACK down the pipeline?
 *
 * Cancelling is not: it is an ending, and it already carries its own warning.
 * Everything else that moves an order to an earlier stage undoes work that has
 * been done — a generated invoice, a sent proposal — and is worth confirming.
 */
export function goesBackwards(
  from: SalesOrderStatus,
  to: SalesOrderStatus,
): boolean {
  if (to === "cancelled") return false;
  const at = (s: SalesOrderStatus) =>
    SALES_JOURNEY.findIndex((stage) => stage.status === s);
  const a = at(from);
  const b = at(to);
  return a >= 0 && b >= 0 && b < a;
}

export function nextAction(
  status: SalesOrderStatus,
  paymentStatus: "unpaid" | "paid",
): NextAction {
  switch (status) {
    case "draft":
      return {
        kind: "proposal",
        label: "Generate proposal",
        hint: "Produces the quotation PDF and marks the proposal sent.",
      };
    case "proposal_generated":
      return {
        kind: "transition",
        to: "proposal_returned",
        label: "Mark proposal returned",
        hint: "Do this once the client sends the marked-up quotation back.",
      };
    case "proposal_returned":
      // Generating the document IS creating the invoice — the status move and
      // the PDF are one step, or the button does not do what it says.
      return {
        kind: "invoice",
        to: "invoiced",
        label: "Create invoice",
        hint: "Issues the invoice number, reserves stock and produces the PDF.",
      };
    case "invoiced":
      return {
        kind: "transition",
        to: "delivered",
        label: "Mark delivered",
        hint: "Writes the reserved stock off. Do this when the goods leave.",
      };
    case "delivered":
      return paymentStatus === "paid"
        ? { kind: "none", label: "", hint: "This order is complete." }
        : {
            kind: "payment",
            label: "Record payment",
            hint: "The last step. Payment counts towards revenue and payroll.",
          };
    default:
      return { kind: "none", label: "", hint: "This order was cancelled." };
  }
}

/**
 * Reasons the next step cannot be taken yet, phrased for the person who has to
 * fix them. An empty list means the primary action is safe to press.
 */
export function blockers(
  status: SalesOrderStatus,
  lines: { description: string; unitPriceMinor: number; qty: number }[],
  /** Whether the lines can be edited at this status. */
  editable = true,
  /**
   * Equipment orders price differently: one figure covers the set, so a
   * line without a price is normal and only the ORDER's total has to be
   * there — and only by the time an invoice is raised.
   */
  kind: "consumables" | "equipment" = "consumables",
): string[] {
  const out: string[] = [];
  if (status === "cancelled" || status === "delivered") return out;

  if (!lines.length) {
    out.push(
      kind === "equipment" ? "Add the equipment." : "Add at least one item.",
    );
    return out;
  }
  const unnamed = lines.filter((l) => !l.description.trim()).length;
  if (unnamed) {
    out.push(
      `${unnamed} ${unnamed === 1 ? "line has" : "lines have"} no description.`,
    );
  }
  if (kind === "equipment") {
    // The offer can go out unpriced; the invoice is what needs a figure.
    const total = lines.reduce((n, l) => n + l.unitPriceMinor * l.qty, 0);
    if (total <= 0 && status === "proposal_returned") {
      out.push(
        "No price on the equipment or any accessory — an invoice cannot be raised.",
      );
    }
  } else {
    const unpriced = lines.filter((l) => l.unitPriceMinor <= 0).length;
    if (unpriced) {
      out.push(
        `${unpriced} ${unpriced === 1 ? "line has" : "lines have"} no price.`,
      );
    }
  }
  const noQty = lines.filter((l) => l.qty <= 0).length;
  if (noQty) {
    out.push(
      `${noQty} ${noQty === 1 ? "line has" : "lines have"} no quantity.`,
    );
  }

  // Being blocked on a screen that will not let you fix it is a dead end. Say
  // how to get back to an editable status instead of leaving the reader stuck.
  if (out.length > 0 && !editable) {
    out.push(
      "The lines cannot be edited at this status — use the actions menu to move the order back to Draft first.",
    );
  }
  return out;
}
