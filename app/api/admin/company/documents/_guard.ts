import { guardSales, type SalesGuard } from "../sales/_guard";
import type { DocumentError } from "@/lib/services/documents/authored-document.service";

/** Written documents are the super admin's, like the rest of Company. */
export function guardDocuments(
  bucket: string,
  limit = 120,
): Promise<SalesGuard> {
  return guardSales(`documents-${bucket}`, limit);
}

/** HTTP status for a document service failure. */
export function documentStatus(code: DocumentError): number {
  switch (code) {
    case "not_found":
      return 404;
    case "locked":
    case "stale":
      return 409;
    case "invalid_body":
      return 400;
    case "print_failed":
    case "vault_failed":
      return 503;
  }
}
