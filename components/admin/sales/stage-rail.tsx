import { Check, CircleDot, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import type { SalesOrderStatus } from "@/lib/schemas/sales-order";
import { stageStates, nextAction } from "@/lib/sales/journey";

/**
 * Where this order is, and what happens next — on every sales screen.
 *
 * The whole complaint about the old flow was that nothing told you where you
 * were. This is the answer: a fixed forward line of the five stages, the marker
 * on the current one, the next step named underneath, and anything blocking it
 * listed in the words of whoever has to fix it.
 */
export function StageRail({
  status,
  paymentStatus,
  blockers = [],
}: {
  status: SalesOrderStatus;
  paymentStatus: "unpaid" | "paid";
  blockers?: string[];
}) {
  const stages = stageStates(status);
  const next = nextAction(status, paymentStatus);
  const cancelled = status === "cancelled";

  return (
    <div className="bg-card rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ol className="flex flex-1 flex-wrap items-center gap-x-1 gap-y-2">
          {stages.map(({ stage, state }, i) => (
            <li key={stage.status} className="flex items-center gap-1">
              <span
                className={cn(
                  "text-admin-xs flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium",
                  state === "current" && !cancelled
                    ? "bg-primary text-primary-foreground"
                    : state === "done" && !cancelled
                      ? "text-foreground bg-muted"
                      : "text-muted-foreground",
                )}
              >
                {state === "done" && !cancelled ? (
                  <Check className="size-3.5" aria-hidden />
                ) : state === "current" && !cancelled ? (
                  <CircleDot className="size-3.5" aria-hidden />
                ) : null}
                {stage.label}
              </span>
              {i < stages.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "h-px w-4",
                    state === "done" && !cancelled ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </li>
          ))}
        </ol>

        <div className="flex items-center gap-2">
          {cancelled && (
            <Badge variant="outline" className="gap-1">
              <XCircle className="size-3.5" aria-hidden />
              Cancelled
            </Badge>
          )}
          {/* Payment sits beside the rail, not on it: an order can be paid
              before or after delivery. */}
          <Badge variant={paymentStatus === "paid" ? "default" : "outline"}>
            {paymentStatus === "paid" ? "Paid" : "Unpaid"}
          </Badge>
        </div>
      </div>

      {(next.hint || blockers.length > 0) && (
        <div className="mt-3 border-t pt-3">
          {blockers.length > 0 ? (
            <div className="">
              <p className="text-destructive flex items-center gap-1.5 font-medium">
                <AlertTriangle className="size-4" aria-hidden />
                {next.label
                  ? `Before you can ${next.label.toLowerCase()}:`
                  : "Needs attention:"}
              </p>
              <ul className="text-muted-foreground mt-1 list-disc pl-6">
                {blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-muted-foreground">
              {next.label ? (
                <>
                  <span className="text-foreground font-medium">
                    Next: {next.label}.
                  </span>{" "}
                  {next.hint}
                </>
              ) : (
                next.hint
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
