"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "@/i18n/navigation";
import { Arrow } from "@/components/ui";
import { useSafeTriangle } from "./use-safe-triangle";

export type CascadeKind =
  | "category"
  | "subcategory"
  | "brand"
  | "product"
  | "link";

export type CascadeNode = {
  id: string;
  label: string;
  kind: CascadeKind;
  href: string;
  image?: string | null;
  /** First-column section header this node belongs to ("By category" / "By brand"). */
  group?: string;
  /** Lazy children loader. Absence ⇒ leaf (a navigable link, no deeper column). */
  loadChildren?: () => Promise<CascadeNode[]>;
};

const TIMINGS = { open: 100, keyboardSuppress: 400 } as const;

type Column = { nodes: CascadeNode[] | null; parentId: string | null };

/**
 * Headless 3-level cascade engine for the dark mega-menu. Owns the open PATH
 * (one node per level — opening a sibling truncates deeper columns), a lazy
 * children cache, hover-intent (100ms) gated by the safe-triangle so diagonal
 * travel toward an open sub-panel never flickers it shut, and full keyboard
 * roving. Columns are flush flex siblings. Branches are buttons (open on
 * hover/click/ArrowRight); leaves are links (navigate). Consumers pass `roots`
 * + per-node `loadChildren`; the engine renders the rest.
 */
export function Cascade({
  roots,
  onNavigate,
}: {
  roots: CascadeNode[];
  onNavigate?: () => void;
}) {
  const [openPath, setOpenPath] = useState<string[]>([]);
  const [childrenById, setChildrenById] = useState<
    Record<string, CascadeNode[]>
  >({});
  const [focus, setFocus] = useState<{ col: number; index: number } | null>(
    null,
  );

  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKey = useRef(0);
  const pendingFocus = useRef<{ col: number; index: number } | null>(null);
  const itemEls = useRef<Map<string, HTMLElement>>(new Map());
  const colEls = useRef<(HTMLElement | null)[]>([]);

  const aim = useSafeTriangle();
  const reduce = useReducedMotion();

  const columns = useMemo<Column[]>(() => {
    const cols: Column[] = [{ nodes: roots, parentId: null }];
    for (const pid of openPath) {
      cols.push({ nodes: childrenById[pid] ?? null, parentId: pid });
    }
    return cols;
  }, [roots, openPath, childrenById]);

  // Point the safe-triangle at the DEEPEST open sub-column (re-read each render).
  useEffect(() => {
    aim.setChildCol(
      columns.length > 1 ? (colEls.current[columns.length - 1] ?? null) : null,
    );
  });

  // Drive DOM focus from the roving (col,index) state.
  useEffect(() => {
    if (!focus) return;
    itemEls.current.get(`${focus.col}:${focus.index}`)?.focus();
  }, [focus]);

  // After a keyboard-opened column finishes loading, move focus into it.
  useEffect(() => {
    const pf = pendingFocus.current;
    if (!pf) return;
    const col = columns[pf.col];
    if (col && col.nodes && col.nodes.length) {
      pendingFocus.current = null;
      setFocus({
        col: pf.col,
        index: Math.min(pf.index, col.nodes.length - 1),
      });
    }
  }, [columns]);

  function loadInto(node: CascadeNode) {
    if (!node.loadChildren || childrenById[node.id] !== undefined) return;
    node
      .loadChildren()
      .then((kids) =>
        setChildrenById((m) =>
          m[node.id] !== undefined ? m : { ...m, [node.id]: kids },
        ),
      )
      .catch(() =>
        setChildrenById((m) =>
          m[node.id] !== undefined ? m : { ...m, [node.id]: [] },
        ),
      );
  }

  function openNode(node: CascadeNode, col: number) {
    if (!node.loadChildren) {
      setOpenPath((p) => (p.length > col ? p.slice(0, col) : p));
      return;
    }
    setOpenPath((p) => [...p.slice(0, col), node.id]);
    loadInto(node);
  }

  function onRowEnter(node: CascadeNode, col: number) {
    if (performance.now() - lastKey.current < TIMINGS.keyboardSuppress) return;
    if (openTimer.current) clearTimeout(openTimer.current);
    if (!node.loadChildren) return; // leaf — nothing to open on hover
    // Re-check aim at fire time: while the cursor is sweeping toward the open
    // sub-panel, defer; the instant the aim decays (or cursor settles), open.
    const fire = () => {
      if (aim.isAiming()) {
        openTimer.current = setTimeout(fire, 60);
        return;
      }
      openNode(node, col);
    };
    openTimer.current = setTimeout(fire, TIMINGS.open);
  }

  function onRowLeave() {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const f = focus ?? { col: 0, index: 0 };
    const colNodes = columns[f.col]?.nodes ?? [];
    const node = colNodes[f.index];
    const k = e.key;
    if (
      [
        "ArrowDown",
        "ArrowUp",
        "ArrowRight",
        "ArrowLeft",
        "Home",
        "End",
        "Enter",
        " ",
      ].includes(k)
    ) {
      lastKey.current = performance.now();
      if (openTimer.current) clearTimeout(openTimer.current);
    }

    if (k === "ArrowDown") {
      e.preventDefault();
      if (colNodes.length)
        setFocus({ col: f.col, index: (f.index + 1) % colNodes.length });
    } else if (k === "ArrowUp") {
      e.preventDefault();
      if (colNodes.length)
        setFocus({
          col: f.col,
          index: (f.index - 1 + colNodes.length) % colNodes.length,
        });
    } else if (k === "Home") {
      e.preventDefault();
      setFocus({ col: f.col, index: 0 });
    } else if (k === "End") {
      e.preventDefault();
      if (colNodes.length) setFocus({ col: f.col, index: colNodes.length - 1 });
    } else if (k === "ArrowRight") {
      e.preventDefault();
      if (node?.loadChildren) {
        openNode(node, f.col);
        pendingFocus.current = { col: f.col + 1, index: 0 };
      }
    } else if (k === "ArrowLeft") {
      e.preventDefault();
      if (f.col > 0) {
        // Close the current column and return focus to the parent row that
        // opened it (truncate the open path by one level).
        const parentId = openPath[f.col - 1];
        const pIdx =
          columns[f.col - 1]?.nodes?.findIndex((n) => n.id === parentId) ?? 0;
        setOpenPath((p) => p.slice(0, f.col - 1));
        setFocus({ col: f.col - 1, index: Math.max(0, pIdx) });
      }
    } else if (k === "Enter" || k === " ") {
      e.preventDefault();
      itemEls.current.get(`${f.col}:${f.index}`)?.click();
    }
  }

  const focusedKey = focus
    ? `${focus.col}:${focus.index}`
    : columns[0]?.nodes?.length
      ? "0:0"
      : null;

  return (
    // role="presentation": the menuitem rows belong to the panel's role="menu"
    // (in resizable-header) — this is a layout wrapper, not a second menu.
    <div
      role="presentation"
      onPointerMove={aim.onPointerMove}
      onKeyDown={onKeyDown}
      style={{ display: "flex", alignItems: "stretch", minWidth: 0 }}
    >
      {columns.map((col, ci) => (
        <ColumnView
          key={ci}
          ci={ci}
          col={col}
          openId={openPath[ci] ?? null}
          focusedKey={focusedKey}
          reduce={!!reduce}
          colRef={(el) => {
            colEls.current[ci] = el;
          }}
          registerItem={(idx, el) => {
            const key = `${ci}:${idx}`;
            if (el) itemEls.current.set(key, el);
            else itemEls.current.delete(key);
          }}
          onRowEnter={onRowEnter}
          onRowLeave={onRowLeave}
          onRowClick={(node) => {
            if (node.loadChildren) openNode(node, ci);
          }}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

function ColumnView({
  ci,
  col,
  openId,
  focusedKey,
  reduce,
  colRef,
  registerItem,
  onRowEnter,
  onRowLeave,
  onRowClick,
  onNavigate,
}: {
  ci: number;
  col: Column;
  openId: string | null;
  focusedKey: string | null;
  reduce: boolean;
  colRef: (el: HTMLElement | null) => void;
  registerItem: (idx: number, el: HTMLElement | null) => void;
  onRowEnter: (node: CascadeNode, col: number) => void;
  onRowLeave: () => void;
  onRowClick: (node: CascadeNode) => void;
  onNavigate?: () => void;
}) {
  const nodes = col.nodes;
  const isGrid =
    !!nodes && nodes.length > 0 && nodes.every((n) => !n.loadChildren);

  const base: React.CSSProperties = {
    flexShrink: 0,
    padding: 12,
    maxHeight: "min(64vh, 420px)",
    overflowY: "auto",
    borderLeft: ci > 0 ? "1px solid var(--color-hairline)" : undefined,
  };
  const sizing: React.CSSProperties = isGrid
    ? { width: 440, maxWidth: "min(46vw, 460px)" }
    : { minWidth: 236, maxWidth: 300 };

  const inner =
    nodes === null ? (
      <Skeleton rows={6} />
    ) : nodes.length === 0 ? (
      <Empty />
    ) : isGrid ? (
      <Grid
        nodes={nodes}
        ci={ci}
        focusedKey={focusedKey}
        registerItem={registerItem}
        onNavigate={onNavigate}
      />
    ) : (
      <List
        nodes={nodes}
        ci={ci}
        openId={openId}
        focusedKey={focusedKey}
        registerItem={registerItem}
        onRowEnter={onRowEnter}
        onRowLeave={onRowLeave}
        onRowClick={onRowClick}
        onNavigate={onNavigate}
      />
    );

  const style = { ...base, ...sizing };
  if (ci === 0 || reduce) {
    return (
      <div ref={colRef} className="mega-col mega-scroll" style={style}>
        {inner}
      </div>
    );
  }
  return (
    <motion.div
      ref={colRef as React.Ref<HTMLDivElement>}
      className="mega-col mega-scroll"
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      style={style}
    >
      {inner}
    </motion.div>
  );
}

function List({
  nodes,
  ci,
  openId,
  focusedKey,
  registerItem,
  onRowEnter,
  onRowLeave,
  onRowClick,
  onNavigate,
}: {
  nodes: CascadeNode[];
  ci: number;
  openId: string | null;
  focusedKey: string | null;
  registerItem: (idx: number, el: HTMLElement | null) => void;
  onRowEnter: (node: CascadeNode, col: number) => void;
  onRowLeave: () => void;
  onRowClick: (node: CascadeNode) => void;
  onNavigate?: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {nodes.map((node, idx) => {
        const showGroup = !!node.group && node.group !== nodes[idx - 1]?.group;
        const active = openId === node.id;
        const isBranch = !!node.loadChildren;
        const key = `${ci}:${idx}`;
        const tab = focusedKey === key ? 0 : -1;
        const row = isBranch ? (
          <button
            type="button"
            data-cascade-item
            role="menuitem"
            aria-haspopup="true"
            aria-expanded={active}
            tabIndex={tab}
            ref={(el) => registerItem(idx, el)}
            className="mega-row"
            onMouseEnter={() => onRowEnter(node, ci)}
            onMouseLeave={onRowLeave}
            onFocus={() => onRowEnter(node, ci)}
            onClick={() => onRowClick(node)}
            style={rowStyle(active)}
          >
            <span style={{ minWidth: 0, ...ellipsis }}>{node.label}</span>
            <span
              className="mega-chevron"
              aria-hidden
              style={{
                color: active ? "var(--teal-300)" : "var(--color-text-muted)",
                display: "inline-flex",
              }}
            >
              <Arrow size={12} />
            </span>
          </button>
        ) : (
          <Link
            href={node.href}
            data-cascade-item
            role="menuitem"
            tabIndex={tab}
            ref={(el) => registerItem(idx, el as unknown as HTMLElement)}
            className="mega-row"
            onClick={onNavigate}
            style={{ ...rowStyle(active), textDecoration: "none" }}
          >
            <span style={{ minWidth: 0, ...ellipsis }}>{node.label}</span>
          </Link>
        );
        return (
          <div key={node.id}>
            {showGroup && <GroupHeader label={node.group as string} />}
            {row}
          </div>
        );
      })}
    </div>
  );
}

function Grid({
  nodes,
  ci,
  focusedKey,
  registerItem,
  onNavigate,
}: {
  nodes: CascadeNode[];
  ci: number;
  focusedKey: string | null;
  registerItem: (idx: number, el: HTMLElement | null) => void;
  onNavigate?: () => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 6,
      }}
    >
      {nodes.map((p, idx) => {
        const key = `${ci}:${idx}`;
        return (
          <Link
            key={p.id}
            href={p.href}
            data-cascade-item
            role="menuitem"
            tabIndex={focusedKey === key ? 0 : -1}
            ref={(el) => registerItem(idx, el as unknown as HTMLElement)}
            className="mega-prod"
            onClick={onNavigate}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: 8,
              borderRadius: "var(--r-md)",
              textDecoration: "none",
              color: "var(--color-text)",
            }}
          >
            <span
              style={{
                flexShrink: 0,
                width: 40,
                height: 40,
                borderRadius: 8,
                overflow: "hidden",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                display: "grid",
                placeItems: "center",
              }}
            >
              {p.image ? (
                <Image
                  src={p.image}
                  alt=""
                  width={40}
                  height={40}
                  style={{ objectFit: "cover", width: 40, height: 40 }}
                />
              ) : (
                <span style={{ color: "var(--teal-300)", fontSize: 16 }}>
                  +
                </span>
              )}
            </span>
            <span style={{ fontSize: 12.5, lineHeight: 1.35, ...clamp2 }}>
              {p.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function GroupHeader({ label }: { label: string }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: ".14em",
        textTransform: "uppercase",
        color: "var(--color-text-muted)",
        padding: "10px 6px 6px",
      }}
    >
      {label}
    </div>
  );
}

function Empty() {
  return (
    <span
      style={{
        display: "block",
        padding: 12,
        fontSize: 13,
        color: "var(--color-text-muted)",
      }}
    >
      Coming online soon.
    </span>
  );
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            height: 34,
            borderRadius: 8,
            background:
              "linear-gradient(90deg, rgba(255,255,255,.06), rgba(255,255,255,.12) 50%, rgba(255,255,255,.06))",
          }}
        />
      ))}
    </div>
  );
}

function rowStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    width: "100%",
    textAlign: "left",
    padding: "9px 12px",
    borderRadius: "var(--r-md)",
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 13,
    lineHeight: 1.3,
    color: active ? "var(--color-text-strong)" : "var(--color-text)",
    // Left-anchored highlight that fades out to the right — a crisp left marker
    // with NO visible right edge (reads as a row highlight, not a bordered box).
    background: active
      ? "linear-gradient(90deg, rgba(28,184,186,0.22), rgba(28,184,186,0) 85%)"
      : "transparent",
    boxShadow: active ? "inset 2px 0 0 var(--teal-300)" : "none",
    transition: "background 140ms",
  };
}

const ellipsis: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const clamp2: React.CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};
