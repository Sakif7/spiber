"use client";

import { usePathname, Link } from "@/i18n/navigation";
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
  type LucideIcon,
} from "lucide-react";
import styles from "./admin.module.css";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { label?: string; items: NavItem[] };

// Admin UI is English-first (per project conventions), so labels are literal.
const GROUPS: NavGroup[] = [
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
    label: "Spiber Kart",
    items: [
      { href: "/admin/marketplace/products", label: "Products", icon: Store },
      {
        href: "/admin/marketplace/categories",
        label: "Categories",
        icon: FolderTree,
      },
      { href: "/admin/brands", label: "Brands", icon: Tag },
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
      {
        href: "/admin/tourism/hospitals",
        label: "Hospitals",
        icon: Building2,
      },
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

function isActive(pathname: string, href: string): boolean {
  // Dashboard is an exact match; sections also match their sub-routes
  // (e.g. /admin/orders/123 keeps "Orders" highlighted).
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav style={{ display: "grid", gap: "var(--s-4)" }}>
      {GROUPS.map((group, gi) => (
        <div key={group.label ?? gi} style={{ display: "grid", gap: 2 }}>
          {group.label && (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--fs-micro)",
                textTransform: "uppercase",
                letterSpacing: "var(--tracking-eyebrow)",
                color: "var(--color-text-subtle)",
                padding: "0 10px var(--s-1)",
              }}
            >
              {group.label}
            </div>
          )}
          {group.items.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={styles.navLink}
                data-active={active || undefined}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={17} strokeWidth={2} aria-hidden />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
