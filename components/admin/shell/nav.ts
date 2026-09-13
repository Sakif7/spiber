import {
  LayoutDashboard,
  Package,
  FolderTree,
  Tag,
  Boxes,
  History,
  ShoppingCart,
  Ticket,
  Settings,
  GraduationCap,
  Users,
  AppWindow,
  Receipt,
  KeyRound,
  ServerCog,
  Percent,
  Inbox,
  Newspaper,
  Tags,
  Store,
  Star,
  FileText,
  PackageSearch,
  ShoppingBag,
  Banknote,
  Image as ImageIcon,
  Trash2,
  CalendarDays,
  Briefcase,
  Mailbox,
  Mail,
  ClipboardList,
  CalendarClock,
  Plane,
  Handshake,
  MapPin,
  Building2,
  Stethoscope,
  PackageOpen,
  MessageSquareQuote,
  MessagesSquare,
  FolderLock,
  CreditCard,
  Landmark,
  FileSpreadsheet,
  UsersRound,
  Wallet,
  ReceiptText,
  LayoutTemplate,
  type LucideIcon,
  ChartNoAxesCombined,
} from "lucide-react";
import { routing } from "@/i18n/routing";

export type NavItem = {
  /** Stable identifier — what favourites/recents persist (never the href). */
  id: string;
  href: string;
  /** Hidden from plain admins (the page and its API enforce this too). */
  superAdminOnly?: boolean;
  /** Short label shown in the sidebar under its group header. */
  label: string;
  /** Unique, self-describing name for the topbar title and Ctrl+K rows
   *  (two groups both have"Products"; only one has"Medtrade products"). */
  title: string;
  icon: LucideIcon;
};
export type NavGroup = {
  label?: string;
  items: NavItem[];
  /** Rarely used groups render behind the sidebar's"More" disclosure. */
  secondary?: boolean;
  /** Whole group hidden from plain admins. */
  superAdminOnly?: boolean;
};

/**
 * The admin is split into sections, switched from the topbar:
 * -"operations": the day-to-day store/division admin (default).
 * -"company":    internal company workspace — the secure document vault,
 *    sales, people and the company-content tabs.
 * -"me":         the employee portal — one person's own desk, mail, leads,
 *    visits, claims and payslips. The only section a plain employee has.
 */
export type AdminSection = "operations" | "company" | "me";

/**
 * Who is looking at the shell. Drives which sections exist and which items
 * show; every page and route re-checks the same facts server-side.
 */
export type NavViewer = {
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isEmployee: boolean;
};

function item(
  id: string,
  href: string,
  label: string,
  icon: LucideIcon,
  title: string = label,
): NavItem {
  return { id, href, label, title, icon };
}

/** Same as `item`, but only super-admins see it in the nav. */
function superItem(
  id: string,
  href: string,
  label: string,
  icon: LucideIcon,
  title: string = label,
): NavItem {
  return { id, href, label, title, icon, superAdminOnly: true };
}

/** Admin UI is English-first (per project conventions), so labels are literal. */
export const OPERATIONS_NAV_GROUPS: NavGroup[] = [
  {
    items: [item("dashboard", "/admin", "Dashboard", LayoutDashboard)],
  },
  {
    label: "Medtrade",
    items: [
      item(
        "medtrade.products",
        "/admin/products",
        "Products",
        Package,
        "Medtrade products",
      ),
      item(
        "medtrade.categories",
        "/admin/categories",
        "Categories",
        FolderTree,
        "Medtrade categories",
      ),
      item("medtrade.quotations", "/admin/quotations", "Quotations", FileText),
      item(
        "medtrade.credit-applications",
        "/admin/credit/applications",
        "Credit Applications",
        CreditCard,
        "Credit applications",
      ),
      item(
        "medtrade.credit-accounts",
        "/admin/credit/accounts",
        "Credit Accounts",
        Landmark,
        "Credit accounts",
      ),
    ],
  },
  {
    label: "Spiber Kart",
    items: [
      item(
        "kart.products",
        "/admin/marketplace/products",
        "Products",
        Store,
        "Spiber Kart products",
      ),
      item(
        "kart.categories",
        "/admin/marketplace/categories",
        "Categories",
        FolderTree,
        "Spiber Kart categories",
      ),
      item("kart.banners", "/admin/marketplace/banners", "Banners", ImageIcon),
      item("kart.reviews", "/admin/marketplace/reviews", "Reviews", Star),
      item(
        "kart.product-requests",
        "/admin/product-requests",
        "Product Requests",
        PackageSearch,
        "Product requests",
      ),
    ],
  },
  {
    // Brands are one cross-storefront collection (Medtrade + Spiber Kart read
    // the same list), so the tab lives ONCE here instead of duplicated in both
    // storefront groups (duplicate hrefs also double-rendered the active
    // indicator, which shares a framer layoutId).
    label: "Catalog",
    items: [item("catalog.brands", "/admin/brands", "Brands", Tag)],
  },
  {
    label: "Sellers",
    items: [
      item("sellers.list", "/admin/sellers", "Sellers", ShoppingBag),
      item(
        "sellers.applications",
        "/admin/sellers/applications",
        "Applications",
        Mailbox,
        "Seller applications",
      ),
      item(
        "sellers.pending-products",
        "/admin/sellers/products",
        "Pending products",
        PackageOpen,
        "Pending seller products",
      ),
      item(
        "sellers.commissions",
        "/admin/sellers/commissions",
        "Commissions",
        Percent,
        "Seller commissions",
      ),
      item(
        "sellers.payouts",
        "/admin/sellers/payouts",
        "Payouts",
        Banknote,
        "Seller payouts",
      ),
      item(
        "sellers.settings",
        "/admin/sellers/settings",
        "Settings",
        Settings,
        "Seller settings",
      ),
    ],
  },
  {
    label: "Commerce",
    items: [
      item("commerce.orders", "/admin/orders", "Orders", ShoppingCart),
      item("commerce.inventory", "/admin/inventory", "Inventory", Boxes),
      item(
        "commerce.movements",
        "/admin/inventory/movements",
        "Movements",
        History,
        "Stock movements",
      ),
      item("commerce.coupons", "/admin/coupons", "Coupons", Ticket),
      item(
        "commerce.settings",
        "/admin/settings",
        "Settings",
        Settings,
        "Commerce settings",
      ),
    ],
  },
  {
    label: "MedAcademy",
    items: [
      item("academy.courses", "/admin/courses", "Courses", GraduationCap),
      item("academy.enrollments", "/admin/enrollments", "Enrollments", Users),
    ],
  },
  {
    label: "Digihealth",
    items: [
      item(
        "digihealth.software",
        "/admin/software-products",
        "Software",
        AppWindow,
        "Software products",
      ),
      item(
        "digihealth.purchases",
        "/admin/software-purchases",
        "Purchases",
        Receipt,
        "Software purchases",
      ),
      item("digihealth.licenses", "/admin/licenses", "Licenses", KeyRound),
      item(
        "digihealth.provisioning",
        "/admin/provisioning",
        "Provisioning",
        ServerCog,
        "Provisioning queue",
      ),
      item(
        "digihealth.commissions",
        "/admin/commissions",
        "Commissions",
        Percent,
        "Affiliate commissions",
      ),
      item("digihealth.inquiries", "/admin/inquiries", "Inquiries", Inbox),
    ],
  },
  {
    label: "Tourism",
    items: [
      item(
        "tourism.cases",
        "/admin/tourism/cases",
        "Cases",
        ClipboardList,
        "Medical cases",
      ),
      item(
        "tourism.appointments",
        "/admin/tourism/appointments",
        "Appointments",
        CalendarClock,
      ),
      item(
        "tourism.travel",
        "/admin/tourism/travel",
        "Travel Requests",
        Plane,
        "Travel requests",
      ),
      item(
        "tourism.partners",
        "/admin/tourism/partners",
        "Partner Applications",
        Handshake,
        "Partner applications",
      ),
      item(
        "tourism.destinations",
        "/admin/tourism/destinations",
        "Destinations",
        MapPin,
      ),
      item(
        "tourism.hospitals",
        "/admin/tourism/hospitals",
        "Hospitals",
        Building2,
      ),
      item("tourism.doctors", "/admin/tourism/doctors", "Doctors", Stethoscope),
      item(
        "tourism.packages",
        "/admin/tourism/packages",
        "Packages",
        PackageOpen,
      ),
    ],
  },
  {
    label: "Blog",
    secondary: true,
    items: [
      item("blog.posts", "/admin/blog/posts", "Posts", Newspaper, "Blog posts"),
      item(
        "blog.taxonomy",
        "/admin/blog/taxonomy",
        "Taxonomy",
        Tags,
        "Blog taxonomy",
      ),
    ],
  },
  {
    label: "System",
    secondary: true,
    items: [
      item("system.maintenance", "/admin/maintenance", "Maintenance", Trash2),
    ],
  },
];

export const COMPANY_NAV_GROUPS: NavGroup[] = [
  {
    items: [
      superItem(
        "company.documents",
        "/admin/company/documents",
        "Documents",
        FolderLock,
        "Company documents",
      ),
      superItem(
        "company.pdf-templates",
        "/admin/company/pdf-templates",
        "PDF templates",
        LayoutTemplate,
        "PDF document templates",
      ),
    ],
  },
  {
    label: "Mail",
    // The company mailbox, read with the portal login. Shared-mailbox
    // assignment is the super admin's.
    items: [
      item("company.mail", "/admin/mail", "Mail", Mail, "Company mail"),
      superItem(
        "company.shared-mailboxes",
        "/admin/company/mail",
        "Shared mailboxes",
        Mailbox,
      ),
    ],
  },
  {
    label: "Sales",
    // Client pricing, negotiations and the company's revenue.
    superAdminOnly: true,
    items: [
      superItem(
        "company.leads",
        "/admin/company/sales/leads",
        "Leads",
        Handshake,
        "Sales leads",
      ),
      superItem(
        "company.sales-orders",
        "/admin/company/sales/orders",
        "Sales orders",
        FileSpreadsheet,
      ),
      superItem(
        "company.sales-report",
        "/admin/company/sales/report",
        "Sales report",
        ChartNoAxesCombined,
      ),
    ],
  },
  {
    label: "People",
    // Pay and percentages: the most sensitive data in the admin.
    superAdminOnly: true,
    items: [
      superItem(
        "company.employees",
        "/admin/company/people/employees",
        "Employees",
        UsersRound,
      ),
      superItem(
        "company.visits",
        "/admin/company/people/visits",
        "Visits",
        MapPin,
      ),
      superItem(
        "company.expenses",
        "/admin/company/people/expenses",
        "Expenses",
        ReceiptText,
      ),
      superItem(
        "company.payroll",
        "/admin/company/people/payroll",
        "Payroll",
        Wallet,
      ),
    ],
  },
  {
    label: "Inbox",
    items: [
      item("company.chat", "/admin/chat", "Chat inbox", MessagesSquare),
      item("company.messages", "/admin/messages", "Messages", Inbox),
    ],
  },
  {
    label: "Content",
    items: [
      item(
        "company.testimonials",
        "/admin/testimonials",
        "Testimonials",
        MessageSquareQuote,
      ),
      item("company.gallery", "/admin/gallery", "Gallery", ImageIcon),
      item("company.events", "/admin/events", "Events", CalendarDays),
    ],
  },
  {
    label: "Careers",
    items: [
      item("company.jobs", "/admin/career", "Jobs", Briefcase),
      item(
        "company.job-applications",
        "/admin/career/applications",
        "Applications",
        Mailbox,
        "Job applications",
      ),
    ],
  },
];

/**
 * The employee portal. Labels say "My …" so it is never mistaken for the
 * company view: every list here is filtered to the signed-in person.
 * Items are added as their pages land (mail, work and pay follow).
 */
export const ME_NAV_GROUPS: NavGroup[] = [
  {
    label: "Me",
    items: [
      item("me.desk", "/admin/me", "My desk", LayoutDashboard),
      item("me.mail", "/admin/me/mail", "Mail", Mail, "My mail"),
    ],
  },
  {
    label: "Work",
    items: [
      item("me.leads", "/admin/me/leads", "My leads", Handshake),
      item("me.orders", "/admin/me/orders", "My sales orders", FileSpreadsheet),
      item("me.visits", "/admin/me/visits", "My visits", MapPin),
      item("me.claims", "/admin/me/claims", "My claims", ReceiptText),
    ],
  },
  {
    label: "Pay",
    items: [item("me.payslips", "/admin/me/payslips", "My payslips", Wallet)],
  },
];

export const NAV_SECTIONS: Record<
  AdminSection,
  { label: string; home: string; groups: NavGroup[] }
> = {
  operations: {
    label: "Operations",
    home: "/admin",
    groups: OPERATIONS_NAV_GROUPS,
  },
  company: {
    label: "Company",
    home: "/admin/company/documents",
    groups: COMPANY_NAV_GROUPS,
  },
  me: {
    label: "Me",
    home: "/admin/me",
    groups: ME_NAV_GROUPS,
  },
};

/** The sections this viewer may switch between, in topbar order. */
export function sectionsFor(viewer: NavViewer): AdminSection[] {
  const out: AdminSection[] = [];
  if (viewer.isAdmin) out.push("operations", "company");
  if (viewer.isEmployee) out.push("me");
  return out;
}

/**
 * The groups of a section that the viewer may see, with hidden items
 * removed. Groups left empty after filtering are dropped; a section the
 * viewer has no business in is empty.
 */
export function navGroupsFor(
  section: AdminSection,
  viewer: NavViewer,
): NavGroup[] {
  if (section === "me") return viewer.isEmployee ? ME_NAV_GROUPS : [];
  if (!viewer.isAdmin) return [];
  if (viewer.isSuperAdmin) return NAV_SECTIONS[section].groups;
  const out: NavGroup[] = [];
  for (const group of NAV_SECTIONS[section].groups) {
    if (group.superAdminOnly) continue;
    const items = group.items.filter((it) => !it.superAdminOnly);
    if (items.length > 0) out.push({ ...group, items });
  }
  return out;
}

/**
 * Where the section switcher should land. The Company section's home is the
 * super-admin-only vault, so a plain admin would otherwise be sent straight to
 * an access-denied card; they get the section's first visible page instead.
 */
export function sectionHomeFor(
  section: AdminSection,
  viewer: NavViewer,
): string {
  const home = NAV_SECTIONS[section].home;
  if (viewer.isSuperAdmin || section === "me") return home;
  const visible = navGroupsFor(section, viewer).flatMap((g) => g.items);
  if (visible.some((it) => it.href === home)) return home;
  return visible[0]?.href ?? NAV_SECTIONS.operations.home;
}

/** All items flattened — topbar title derivation + the Ctrl+K palette. */
export const NAV_ITEMS_FLAT: NavItem[] = [
  ...OPERATIONS_NAV_GROUPS,
  ...COMPANY_NAV_GROUPS,
  ...ME_NAV_GROUPS,
].flatMap((g) => g.items);

/** Lookup by stable id (favourites / recents resolve through this). */
export const NAV_BY_ID: ReadonlyMap<string, NavItem> = new Map(
  NAV_ITEMS_FLAT.map((it) => [it.id, it]),
);

/** Section + group labels for an item (the palette's trailing caption). */
export function navContextFor(id: string): {
  section: AdminSection;
  group?: string;
} | null {
  for (const section of Object.keys(NAV_SECTIONS) as AdminSection[]) {
    for (const group of NAV_SECTIONS[section].groups) {
      if (group.items.some((it) => it.id === id)) {
        return { section, group: group.label };
      }
    }
  }
  return null;
}

const LOCALE_PREFIX = new RegExp(`^\\/(${routing.locales.join("|")})(?=\\/|$)`);

/** Strip a leading locale segment (/en, /bn, /ja) — matching is locale-agnostic. */
export function stripLocalePrefix(pathname: string): string {
  return pathname.replace(LOCALE_PREFIX, "") || "/";
}

/** Does `href` cover `path` (itself or a descendant)? The dashboard root only
 * matches itself, otherwise it would cover every admin page; the same for the
 * employee desk, so "My desk" is not lit on every portal page. */
function covers(path: string, href: string): boolean {
  if (href === "/admin" || href === "/admin/me") return path === href;
  return path === href || path.startsWith(`${href}/`);
}

/**
 * The single nav item that owns `pathname`: the LONGEST matching href wins, so
 * a parent item (e.g. `/admin/sellers`) is not lit as well when a sibling item
 * covers a deeper path (`/admin/sellers/commissions`). `null` when no item
 * covers the path (e.g. a detail page under an unlisted route).
 */
export function activeItemFor(pathname: string): NavItem | null {
  const path = stripLocalePrefix(pathname);
  let best: NavItem | null = null;
  for (const it of NAV_ITEMS_FLAT) {
    if (
      covers(path, it.href) &&
      (best === null || it.href.length > best.href.length)
    ) {
      best = it;
    }
  }
  return best;
}

export function activeHrefFor(pathname: string): string | null {
  return activeItemFor(pathname)?.href ?? null;
}

/** Exactly one item is active for any path (see `activeItemFor`). */
export function isNavItemActive(pathname: string, href: string): boolean {
  return activeHrefFor(pathname) === href;
}

/** Unique page title for the topbar;"Admin" when no item owns the path. */
export function activeTitleFor(pathname: string): string {
  return activeItemFor(pathname)?.title ?? "Admin";
}

/**
 * Which section the current page belongs to (drives the topbar switcher).
 * A plain employee only ever has "me"; anything under /admin/me is "me" for
 * everyone, so an admin-employee's desk pages do not flip them to Operations.
 */
export function sectionForPath(
  pathname: string,
  viewer: NavViewer = { isSuperAdmin: true, isAdmin: true, isEmployee: false },
): AdminSection {
  if (!viewer.isAdmin) return "me";
  const path = stripLocalePrefix(pathname);
  if (path === "/admin/me" || path.startsWith("/admin/me/")) return "me";
  const active = activeItemFor(pathname);
  if (active && ME_NAV_GROUPS.some((g) => g.items.includes(active))) {
    return viewer.isEmployee ? "me" : "company";
  }
  if (active && COMPANY_NAV_GROUPS.some((g) => g.items.includes(active))) {
    return "company";
  }
  return "operations";
}
