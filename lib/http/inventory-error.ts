import { fail } from "@/lib/http/respond";
import {
  InsufficientStockError,
  SellerManagedError,
  StockChangedError,
  UnitNotFoundError,
} from "@/lib/services/inventory.service";

/** Map the inventory service's typed errors to API responses; null = unknown. */
export function inventoryErrorResponse(e: unknown): Response | null {
  if (e instanceof InsufficientStockError) {
    return fail(
      {
        code: "insufficient_stock",
        message: "Not enough stock on hand for that change.",
      },
      409,
    );
  }
  if (e instanceof StockChangedError) {
    return fail(
      {
        code: "stock_changed",
        message: "The stock changed while you were editing — reload and retry.",
      },
      409,
    );
  }
  if (e instanceof UnitNotFoundError) {
    return fail({ code: "not_found", message: "Stock unit not found." }, 404);
  }
  if (e instanceof SellerManagedError) {
    return fail(
      {
        code: "seller_managed",
        message:
          "This listing's stock is managed by its seller. Use Override to change it (the seller is notified).",
      },
      403,
    );
  }
  return null;
}
