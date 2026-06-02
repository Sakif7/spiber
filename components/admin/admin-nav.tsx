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
  type LucideIcon,
} from "lucide-react";
import styles from "./admin.module.css";

type NavItem = { href: string; label: string; icon: LucideIcon };

// Admin UI is English-first (per project conventions), so labels are literal.
const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/brands", label: "Brands", icon: Tag },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/coupons", label: "Coupons", icon: Ticket },
  { href: "/admin/settings", label: "Settings", icon: Settings },
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
    <nav style={{ display: "grid", gap: 2 }}>
      {NAV.map(({ href, label, icon: Icon }) => {
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
    </nav>
  );
}
