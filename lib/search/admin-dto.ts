/**
 * Wire types for the admin command-palette record search (GET
 * /api/admin/search). Kept free of server imports so the client palette can
 * import them without pulling Mongoose into the browser bundle.
 */
export const ADMIN_SEARCH_GROUPS = [
  "orders",
  "quotations",
  "products",
  "customers",
  "sellers",
  "cases",
  "appointments",
] as const;

export type AdminSearchGroupKey = (typeof ADMIN_SEARCH_GROUPS)[number];

export const ADMIN_SEARCH_GROUP_LABELS: Record<AdminSearchGroupKey, string> = {
  orders: "Orders",
  quotations: "Quotations",
  products: "Products",
  customers: "Customers",
  sellers: "Sellers",
  cases: "Medical cases",
  appointments: "Appointments",
};

/** One render-ready hit: everything is pre-formatted on the server. */
export type AdminSearchHit = {
  id: string;
  group: AdminSearchGroupKey;
  /** Primary line, e.g. the order number or product name. */
  title: string;
  /** Secondary line, e.g. "customer@example.com · Spiber Kart · ৳1,480". */
  subtitle?: string;
  /** Short status/badge text (rendered as a StatusBadge). */
  badge?: string;
  /** Locale-relative admin path to open. */
  href: string;
};

export type AdminSearchGroup = {
  key: AdminSearchGroupKey;
  label: string;
  hits: AdminSearchHit[];
};

export type AdminSearchResponse = {
  query: string;
  total: number;
  groups: AdminSearchGroup[];
};
