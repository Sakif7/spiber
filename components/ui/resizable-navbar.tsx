"use client";

import React, { useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from "framer-motion";
import { cn } from "@/lib/cn";

interface NavbarProps {
  children: React.ReactNode;
  className?: string;
}

interface NavBodyProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}

interface NavItemsProps {
  items: { name: string; link: string }[];
  className?: string;
  onItemClick?: (item: { name: string; link: string }) => void;
  onItemHover?: (name: string | null) => void;
}

interface MobileNavProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}

interface MobileNavHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface MobileNavMenuProps {
  children: React.ReactNode;
  className?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const Navbar = ({ children, className }: NavbarProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const [visible, setVisible] = useState<boolean>(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setVisible(latest > 100);
  });

  return (
    <motion.div
      ref={ref}
      className={cn("sticky inset-x-0 top-4 z-40 w-full", className)}
    >
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(
              child as React.ReactElement<{ visible?: boolean }>,
              { visible }
            )
          : child
      )}
    </motion.div>
  );
};

export const NavBody = ({ children, className, visible }: NavBodyProps) => {
  return (
    <motion.div
      animate={{
        backdropFilter: visible ? "blur(14px) saturate(180%)" : "blur(0px)",
        boxShadow: visible
          ? "0 1px 2px rgba(10,31,44,.05), 0 12px 36px -8px rgba(10,31,44,.12), 0 0 0 1px rgba(10,31,44,.04)"
          : "none",
        width: visible ? "62%" : "100%",
        y: visible ? 8 : 0,
      }}
      transition={{ type: "spring", stiffness: 200, damping: 50 }}
      style={{ minWidth: 780 }}
      className={cn(
        "relative z-[60] mx-auto hidden w-full max-w-[1240px] flex-row items-center justify-between self-start rounded-full bg-transparent px-4 py-2 lg:flex",
        visible && "bg-white/80",
        className
      )}
    >
      {children}
    </motion.div>
  );
};

export const NavItems = ({ items, className, onItemClick, onItemHover }: NavItemsProps) => {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <motion.div
      onMouseLeave={() => {
        setHovered(null);
        onItemHover?.(null);
      }}
      className={cn(
        "hidden flex-1 flex-row items-center justify-center text-sm font-medium lg:flex",
        className
      )}
    >
      {items.map((item, idx) => (
        <a
          onMouseEnter={() => {
            setHovered(idx);
            onItemHover?.(item.name);
          }}
          onFocus={() => {
            setHovered(idx);
            onItemHover?.(item.name);
          }}
          onClick={(e) => {
            if (item.link === "#") e.preventDefault();
            onItemClick?.(item);
          }}
          className="relative px-4 py-2"
          style={{ color: "var(--color-text)" }}
          key={`link-${idx}`}
          href={item.link}
        >
          {hovered === idx && (
            <motion.div
              layoutId="nav-hover"
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className="absolute inset-0 h-full w-full rounded-full"
              style={{ background: "var(--teal-50)" }}
            />
          )}
          <span className="relative z-20" style={{ color: "var(--color-text)" }}>
            {item.name}
          </span>
        </a>
      ))}
    </motion.div>
  );
};

export const MobileNav = ({ children, className, visible }: MobileNavProps) => {
  return (
    <motion.div
      animate={{
        backdropFilter: visible ? "blur(14px) saturate(180%)" : "blur(0px)",
        boxShadow: visible
          ? "0 1px 2px rgba(10,31,44,.05), 0 12px 36px -8px rgba(10,31,44,.12), 0 0 0 1px rgba(10,31,44,.04)"
          : "none",
        width: visible ? "92%" : "100%",
        paddingRight: visible ? 12 : 0,
        paddingLeft: visible ? 12 : 0,
        borderRadius: visible ? 16 : 24,
        y: visible ? 8 : 0,
      }}
      transition={{ type: "spring", stiffness: 200, damping: 50 }}
      className={cn(
        "relative z-50 mx-auto flex w-full max-w-[calc(100vw-2rem)] flex-col items-center justify-between bg-transparent px-0 py-2 lg:hidden",
        visible && "bg-white/85",
        className
      )}
    >
      {children}
    </motion.div>
  );
};

export const MobileNavHeader = ({ children, className }: MobileNavHeaderProps) => {
  return (
    <div className={cn("flex w-full flex-row items-center justify-between", className)}>
      {children}
    </div>
  );
};

export const MobileNavMenu = ({ children, className, isOpen }: MobileNavMenuProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "absolute inset-x-0 top-16 z-50 flex w-full flex-col items-start justify-start gap-2 rounded-2xl bg-white px-4 py-6",
            className
          )}
          style={{
            boxShadow:
              "0 1px 2px rgba(10,31,44,.05), 0 20px 60px -16px rgba(10,31,44,.18), 0 0 0 1px rgba(10,31,44,.04)",
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const MobileNavToggle = ({
  isOpen,
  onClick,
}: {
  isOpen: boolean;
  onClick: () => void;
}) => {
  return (
    <button
      onClick={onClick}
      aria-label={isOpen ? "Close menu" : "Open menu"}
      style={{
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: 6,
        color: "var(--color-text-strong)",
      }}
    >
      {isOpen ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M6 6l12 12M6 18L18 6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
};
