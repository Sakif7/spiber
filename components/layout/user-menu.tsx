"use client";

import { useState } from "react";
import { ChevronDown, Package, LayoutDashboard, LogOut } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useSession, workspaceFor } from "@/components/auth/use-session";
import { useAuthModal } from "@/components/auth/auth-modal";

/** Desktop navbar account control: "Login" when signed out, a name + menu when signed in. */
export function UserMenu() {
  const { user, isLoading, signOut } = useSession();
  const { open: openAuth } = useAuthModal();
  const [open, setOpen] = useState(false);

  // Optimistic logged-out during the initial fetch (most visitors are guests).
  if (isLoading || !user) {
    return (
      <button
        type="button"
        onClick={() => openAuth("login")}
        style={{
          fontSize: 13,
          color: "var(--color-text-muted)",
          padding: "8px 10px",
          cursor: "pointer",
          background: "none",
          border: "none",
          fontFamily: "inherit",
        }}
      >
        Login
      </button>
    );
  }

  const firstName = user.name.split(" ")[0] || user.name;
  const initial = (user.name || user.email).charAt(0).toUpperCase();
  const workspace = workspaceFor(user);

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 10px 5px 6px",
          borderRadius: 999,
          border: "1px solid var(--color-border)",
          background: open ? "var(--color-surface-2)" : "var(--color-surface)",
          color: "var(--color-text)",
          fontSize: 13,
          fontWeight: 500,
          fontFamily: "inherit",
          cursor: "pointer",
          transition: "background 160ms",
        }}
      >
        <span
          aria-hidden
          style={{
            display: "grid",
            placeItems: "center",
            width: 26,
            height: 26,
            borderRadius: "var(--r-pill)",
            background: "var(--color-brand-soft)",
            color: "var(--color-brand-deep)",
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          {initial}
        </span>
        {firstName}
        <ChevronDown
          size={14}
          style={{
            transition: "transform 180ms",
            transform: open ? "rotate(180deg)" : "none",
          }}
        />
      </button>

      {open && (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 65,
              background: "transparent",
              border: "none",
              cursor: "default",
            }}
          />
          <div
            role="menu"
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 8px)",
              zIndex: 70,
              minWidth: 200,
              padding: 6,
              borderRadius: "var(--r-md)",
              background: "var(--color-surface)",
              border: "1px solid var(--color-hairline)",
              boxShadow: "var(--shadow-lg)",
              display: "grid",
              gap: 2,
            }}
          >
            <div
              style={{
                padding: "6px 10px 8px",
                borderBottom: "1px solid var(--color-hairline)",
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--color-text-strong)",
                }}
              >
                {user.name}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--color-text-muted)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {user.email}
              </div>
            </div>

            <Link
              href="/account/orders"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="user-menu-item"
            >
              <Package size={15} /> My orders
            </Link>
            {workspace && (
              <Link
                href={workspace.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="user-menu-item"
              >
                <LayoutDashboard size={15} /> {workspace.label}
              </Link>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
              className="user-menu-item"
              style={{
                background: "none",
                border: "none",
                width: "100%",
                font: "inherit",
                cursor: "pointer",
                color: "var(--color-error)",
              }}
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </>
      )}

      <style>{`
        .user-menu-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: var(--r-sm);
          font-size: 13.5px;
          color: var(--color-text);
          text-decoration: none;
          transition: background 140ms;
          text-align: left;
        }
        .user-menu-item:hover { background: var(--color-surface-2); }
      `}</style>
    </div>
  );
}
