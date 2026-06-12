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
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { label?: string; items: NavItem[] };

/** Admin UI is English-first (per project conventions), so labels are literal. */
export const NAV_GROUPS: NavGroup[] = [
  { items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Medtrade (Quotes)",
    items: [
      { href: "/admin/products", label: "Products", icon: Package },
      { href: "/admin/categories", label: "Categories", icon: FolderTree },
      { href: "/admin/brands", label: "Brands", icon: Tag },
      { href: "/admin/quotations", label: "Quotations", icon: FileText },
    ],
  },
  {
    label: "Marketplace",
    items: [
      { href: "/admin/marketplace/products", label: "Products", icon: Store },
      {
        href: "/admin/marketplace/categories",
        label: "Categories",
        icon: FolderTree,
      },
      { href: "/admin/marketplace/banners", label: "Banners", icon: ImageIcon },
      { href: "/admin/marketplace/reviews", label: "Reviews", icon: Star },
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
    label: "Academy",
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
    label: "Company",
    items: [
      {
        href: "/admin/testimonials",
        label: "Testimonials",
        icon: MessageSquareQuote,
      },
      { href: "/admin/gallery", label: "Gallery", icon: ImageIcon },
      { href: "/admin/events", label: "Events", icon: CalendarDays },
      { href: "/admin/career", label: "Jobs", icon: Briefcase },
      {
        href: "/admin/career/applications",
        label: "Applications",
        icon: Mailbox,
      },
    ],
  },
  {
    label: "System",
    items: [{ href: "/admin/maintenance", label: "Maintenance", icon: Trash2 }],
  },
];

/** All items flattened — used by the topbar to derive the current page title. */
export const NAV_ITEMS_FLAT: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function isNavItemActive(pathname: string, href: string): boolean {
  // Strip a leading locale segment (/en, /bn) so matching is locale-agnostic.
  const path = pathname.replace(/^\/(en|bn)(?=\/|$)/, "") || "/";
  if (href === "/admin") return path === "/admin";
  return path === href || path.startsWith(`${href}/`);
}
