import {
  LayoutDashboard,
  Package,
  FolderTree,
  Tag,
  Boxes,
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
  type LucideIcon,
} from "lucide-react";
import { routing } from "@/i18n/routing";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { label?: string; items: NavItem[] };

/**
 * The admin is split into two sections, switched from the topbar:
 *  - "operations": the day-to-day store/division admin (default).
 *  - "company":    internal company workspace — today the secure document
 *    vault + the existing company-content tabs; the future HRM modules will
 *    add their groups here without touching the operations tree.
 */
export type AdminSection = "operations" | "company";

/** Admin UI is English-first (per project conventions), so labels are literal. */
export const OPERATIONS_NAV_GROUPS: NavGroup[] = [
  { items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Medtrade (Quotes)",
    items: [
      { href: "/admin/products", label: "Products", icon: Package },
      { href: "/admin/categories", label: "Categories", icon: FolderTree },
      { href: "/admin/quotations", label: "Quotations", icon: FileText },
    ],
  },
  {
    label: "Spiber Kart",
    items: [
      { href: "/admin/marketplace/products", label: "Products", icon: Store },
      {
        href: "/admin/marketplace/categories",
        label: "Categories",
        icon: FolderTree,
      },
      { href: "/admin/marketplace/banners", label: "Banners", icon: ImageIcon },
      { href: "/admin/marketplace/reviews", label: "Reviews", icon: Star },
      {
        href: "/admin/product-requests",
        label: "Product Requests",
        icon: PackageSearch,
      },
    ],
  },
  {
    // Brands are one cross-storefront collection (Medtrade + Spiber Kart read
    // the same list), so the tab lives ONCE here instead of duplicated in both
    // storefront groups (duplicate hrefs also double-rendered the active
    // indicator, which shares a framer layoutId).
    label: "Shared",
    items: [{ href: "/admin/brands", label: "Brands", icon: Tag }],
  },
  {
    label: "Sellers",
    items: [
      { href: "/admin/sellers", label: "Sellers", icon: ShoppingBag },
      {
        href: "/admin/sellers/applications",
        label: "Applications",
        icon: Mailbox,
      },
      {
        href: "/admin/sellers/products",
        label: "Pending products",
        icon: PackageOpen,
      },
      {
        href: "/admin/sellers/commissions",
        label: "Commissions",
        icon: Percent,
      },
      { href: "/admin/sellers/payouts", label: "Payouts", icon: Banknote },
      { href: "/admin/sellers/settings", label: "Settings", icon: Settings },
    ],
  },
  {
    label: "Commerce",
    items: [
      { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
      { href: "/admin/inventory", label: "Inventory", icon: Boxes },
      { href: "/admin/coupons", label: "Coupons", icon: Ticket },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
  {
    label: "MedAcademy",
    items: [
      { href: "/admin/courses", label: "Courses", icon: GraduationCap },
      { href: "/admin/enrollments", label: "Enrollments", icon: Users },
    ],
  },
  {
    label: "Digihealth",
    items: [
      { href: "/admin/software-products", label: "Software", icon: AppWindow },
      { href: "/admin/software-purchases", label: "Purchases", icon: Receipt },
      { href: "/admin/licenses", label: "Licenses", icon: KeyRound },
      { href: "/admin/provisioning", label: "Provisioning", icon: ServerCog },
      { href: "/admin/commissions", label: "Commissions", icon: Percent },
      { href: "/admin/inquiries", label: "Inquiries", icon: Inbox },
    ],
  },
  {
    label: "Tourism",
    items: [
      { href: "/admin/tourism/cases", label: "Cases", icon: ClipboardList },
      {
        href: "/admin/tourism/appointments",
        label: "Appointments",
        icon: CalendarClock,
      },
      { href: "/admin/tourism/travel", label: "Travel Requests", icon: Plane },
      {
        href: "/admin/tourism/partners",
        label: "Partner Applications",
        icon: Handshake,
      },
      {
        href: "/admin/tourism/destinations",
        label: "Destinations",
        icon: MapPin,
      },
      { href: "/admin/tourism/hospitals", label: "Hospitals", icon: Building2 },
      { href: "/admin/tourism/doctors", label: "Doctors", icon: Stethoscope },
      {
        href: "/admin/tourism/packages",
        label: "Packages",
        icon: PackageOpen,
      },
    ],
  },
  {
    label: "Blog",
    items: [
      { href: "/admin/blog/posts", label: "Posts", icon: Newspaper },
      { href: "/admin/blog/taxonomy", label: "Taxonomy", icon: Tags },
    ],
  },
  {
    label: "System",
    items: [{ href: "/admin/maintenance", label: "Maintenance", icon: Trash2 }],
  },
];

export const COMPANY_NAV_GROUPS: NavGroup[] = [
  {
    items: [
      {
        href: "/admin/company/documents",
        label: "Documents",
        icon: FolderLock,
      },
    ],
  },
  {
    label: "Inbox",
    items: [
      { href: "/admin/chat", label: "Chat inbox", icon: MessagesSquare },
      { href: "/admin/messages", label: "Messages", icon: Inbox },
    ],
  },
  {
    label: "Content",
    items: [
      {
        href: "/admin/testimonials",
        label: "Testimonials",
        icon: MessageSquareQuote,
      },
      { href: "/admin/gallery", label: "Gallery", icon: ImageIcon },
      { href: "/admin/events", label: "Events", icon: CalendarDays },
    ],
  },
  {
    label: "Careers",
    items: [
      { href: "/admin/career", label: "Jobs", icon: Briefcase },
      {
        href: "/admin/career/applications",
        label: "Applications",
        icon: Mailbox,
      },
    ],
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
};

/** All items flattened — topbar title derivation + the Ctrl+K palette. */
export const NAV_ITEMS_FLAT: NavItem[] = [
  ...OPERATIONS_NAV_GROUPS,
  ...COMPANY_NAV_GROUPS,
].flatMap((g) => g.items);

const LOCALE_PREFIX = new RegExp(`^\\/(${routing.locales.join("|")})(?=\\/|$)`);

/** Strip a leading locale segment (/en, /bn, /ja) — matching is locale-agnostic. */
export function stripLocalePrefix(pathname: string): string {
  return pathname.replace(LOCALE_PREFIX, "") || "/";
}

export function isNavItemActive(pathname: string, href: string): boolean {
  const path = stripLocalePrefix(pathname);
  if (href === "/admin") return path === "/admin";
  return path === href || path.startsWith(`${href}/`);
}

/** Which section the current page belongs to (drives the topbar switcher). */
export function sectionForPath(pathname: string): AdminSection {
  for (const item of COMPANY_NAV_GROUPS.flatMap((g) => g.items)) {
    if (isNavItemActive(pathname, item.href)) return "company";
  }
  return "operations";
}
