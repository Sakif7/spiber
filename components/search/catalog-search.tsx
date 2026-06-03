"use client";

import {
  CSSProperties,
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Arrow } from "@/components/ui";
import {
  type SearchGroupDTO,
  type SearchGroupKey,
  type SearchHit,
  type SearchResponseDTO,
} from "@/lib/search/dto";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 170;
const EASE = [0.16, 1, 0.3, 1] as const;

type Mode = "inline" | "overlay";
type Translate = ReturnType<typeof useTranslations>;

/* ---- small inline icons, one per division (line style, currentColor) ---- */
const GROUP_ICON: Record<SearchGroupKey, ReactNode> = {
  instruments: (
    <path d="M9 3v6.5L4.8 17a3 3 0 0 0 2.6 4.5h9.2A3 3 0 0 0 19.2 17L15 9.5V3M8 3h8M9 13h6" />
  ),
  academy: (
    <path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Zm4 3v4.2c0 .9 2.2 2.3 5 2.3s5-1.4 5-2.3V11.5" />
  ),
  systems: <path d="M3 5h18v12H3zM3 9h18M8 21h8M12 17v4" />,
  blog: <path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7M9 8h3" />,
};

function MagnifierIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--brand-teal)"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="catalog-search-spinner"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="8.5"
        stroke="var(--color-border)"
        strokeWidth="2.4"
      />
      <path
        d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5"
        stroke="var(--brand-teal)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GroupGlyph({ group }: { group: SearchGroupKey }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 40,
        height: 40,
        flexShrink: 0,
        borderRadius: 10,
        background: "var(--color-brand-soft)",
        color: "var(--brand-teal)",
      }}
    >
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {GROUP_ICON[group]}
      </svg>
    </span>
  );
}

const msgStyle: CSSProperties = {
  margin: 0,
  fontSize: 13.5,
  color: "var(--color-text-muted)",
};

/** Shared pill (command bar) chrome — collapsed trigger & expanded bar reuse it. */
function pillStyle(height: number, ring: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    height,
    paddingLeft: 18,
    paddingRight: 7,
    background: "var(--color-surface)",
    border: `1px solid ${ring ? "var(--brand-teal)" : "var(--color-border)"}`,
    borderRadius: 999,
    boxShadow: ring
      ? "var(--shadow-brand), 0 0 0 4px color-mix(in oklab, var(--brand-teal) 14%, transparent)"
      : "var(--shadow-sm)",
  };
}

/* ============================================================ */
/* Shared results list (groups, rows, footer, empty/idle)       */
/* ============================================================ */
function ResultsList({
  groups,
  total,
  loading,
  trimmed,
  hasQuery,
  active,
  idle,
  idPrefix,
  listboxId,
  ariaLabel,
  maxHeight,
  t,
  onActivate,
  onSelect,
}: {
  groups: SearchGroupDTO[];
  total: number;
  loading: boolean;
  trimmed: string;
  hasQuery: boolean;
  active: number;
  idle: boolean;
  idPrefix: string;
  listboxId: string;
  ariaLabel: string;
  maxHeight: string;
  t: Translate;
  onActivate: (i: number) => void;
  onSelect: () => void;
}) {
  let running = -1;
  return (
    <>
      <div
        id={listboxId}
        role="listbox"
        aria-label={ariaLabel}
        className="catalog-search-panel"
        style={{ maxHeight, overflowY: "auto" }}
      >
        {idle ? (
          <p style={{ ...msgStyle, padding: "22px 20px", textAlign: "center" }}>
            {t("idleHint")}
          </p>
        ) : groups.length === 0 ? (
          <div style={{ padding: "26px 20px", textAlign: "center" }}>
            {loading ? (
              <p style={msgStyle}>{t("searching")}</p>
            ) : (
              <>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14.5,
                    fontWeight: 500,
                    color: "var(--color-text-strong)",
                  }}
                >
                  {t("noResults", { query: trimmed })}
                </p>
                <p style={{ ...msgStyle, marginTop: 4 }}>
                  {t("noResultsHint")}
                </p>
              </>
            )}
          </div>
        ) : (
          groups.map((g) => (
            <div
              key={g.key}
              role="group"
              aria-labelledby={`${idPrefix}-h-${g.key}`}
            >
              <div
                id={`${idPrefix}-h-${g.key}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "13px 16px 6px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--color-text-muted)",
                }}
              >
                <span>{t(`groups.${g.key}`)}</span>
                <span style={{ color: "var(--brand-teal)" }}>{g.total}</span>
              </div>
              {g.hits.map((hit) => {
                running += 1;
                const i = running;
                const isActive = i === active;
                return (
                  <Link
                    key={hit.id}
                    id={`${idPrefix}-opt-${i}`}
                    role="option"
                    aria-selected={isActive}
                    href={hit.href}
                    onMouseEnter={() => onActivate(i)}
                    onClick={onSelect}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "9px 16px",
                      textDecoration: "none",
                      borderLeft: `2px solid ${
                        isActive ? "var(--brand-teal)" : "transparent"
                      }`,
                      background: isActive
                        ? "var(--color-brand-soft)"
                        : "transparent",
                      transition: "background .14s, border-color .14s",
                    }}
                  >
                    {hit.image ? (
                      <span
                        style={{
                          position: "relative",
                          width: 40,
                          height: 40,
                          flexShrink: 0,
                          borderRadius: 10,
                          overflow: "hidden",
                          background: "var(--color-surface-2)",
                        }}
                      >
                        <Image
                          src={hit.image}
                          alt=""
                          fill
                          sizes="40px"
                          style={{ objectFit: "cover" }}
                        />
                      </span>
                    ) : (
                      <GroupGlyph group={hit.group} />
                    )}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: 14,
                          fontWeight: 500,
                          color: "var(--color-text-strong)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {hit.title}
                      </span>
                      {hit.subtitle && (
                        <span
                          style={{
                            display: "block",
                            fontSize: 12.5,
                            color: "var(--color-text-muted)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {hit.subtitle}
                        </span>
                      )}
                    </span>
                    <motion.span
                      animate={{
                        opacity: isActive ? 1 : 0,
                        x: isActive ? 0 : -4,
                      }}
                      transition={{ duration: 0.18, ease: EASE }}
                      style={{
                        display: "inline-flex",
                        flexShrink: 0,
                        color: "var(--brand-teal)",
                      }}
                    >
                      <Arrow size={14} />
                    </motion.span>
                  </Link>
                );
              })}
            </div>
          ))
        )}
      </div>

      {!idle && hasQuery && (
        <Link
          href={`/search?q=${encodeURIComponent(trimmed)}`}
          onClick={onSelect}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "12px 16px",
            borderTop: "1px solid var(--color-border)",
            background: "var(--color-surface-2)",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--brand-teal)",
          }}
        >
          <span>
            {groups.length === 0
              ? t("searchEverything", { query: trimmed })
              : t("seeAll", { count: total })}
          </span>
          <Arrow size={14} />
        </Link>
      )}
    </>
  );
}

/* ============================================================ */
/* CatalogSearch                                                */
/* ============================================================ */
export function CatalogSearch({
  mode = "inline",
  defaultValue = "",
  autoFocus = false,
  enableShortcut = true,
}: {
  mode?: Mode;
  defaultValue?: string;
  autoFocus?: boolean;
  enableShortcut?: boolean;
}) {
  const t = useTranslations("search");
  const locale = useLocale();
  const router = useRouter();
  const reduce = useReducedMotion();
  const rootId = useId().replace(/[:]/g, "");
  const listboxId = `${rootId}-listbox`;
  const barLayoutId = `${rootId}-bar`;

  const [value, setValue] = useState(defaultValue);
  const [groups, setGroups] = useState<SearchGroupDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  // Hydration-safe "are we on the client?" — needed before portalling to body.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLFormElement>(null);
  const overlayRef = useRef<HTMLFormElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reqIdRef = useRef(0);

  const isOverlay = mode === "overlay";

  const flat = useMemo<SearchHit[]>(
    () => groups.flatMap((g) => g.hits),
    [groups],
  );

  const trimmed = value.trim();
  const hasQuery = trimmed.length >= MIN_CHARS;
  // Inline: panel hangs under the focused bar. Overlay: panel shows whenever open.
  const panelOpen = isOverlay ? open : open && focused && hasQuery;

  const layoutTransition = useMemo(
    () => ({ duration: reduce ? 0 : 0.3, ease: EASE }),
    [reduce],
  );

  const clearResults = useCallback(() => {
    abortRef.current?.abort();
    reqIdRef.current += 1; // invalidate any in-flight response
    setGroups([]);
    setTotal(0);
    setActive(-1);
    setLoading(false);
  }, []);

  const goToResults = useCallback(
    (q: string) => {
      const term = q.trim();
      if (term.length < MIN_CHARS) return;
      setOpen(false);
      router.push(`/search?q=${encodeURIComponent(term)}`);
    },
    [router],
  );

  const closeOverlay = useCallback(() => {
    setOpen(false);
    setValue("");
    clearResults();
    // Return focus to the trigger that opened the palette.
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, [clearResults]);

  // Debounced fetch, race-guarded + abortable. Clearing on short queries is
  // handled in the change handler so we never setState synchronously here.
  useEffect(() => {
    if (!hasQuery) return;
    const reqId = ++reqIdRef.current;
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}&locale=${locale}`,
          { signal: ac.signal },
        );
        const json = (await res.json()) as {
          ok: boolean;
          data?: SearchResponseDTO;
        };
        if (reqId !== reqIdRef.current) return; // superseded
        setGroups(json.data?.groups ?? []);
        setTotal(json.data?.total ?? 0);
        setActive(-1);
      } catch (e) {
        if ((e as Error)?.name !== "AbortError" && reqId === reqIdRef.current) {
          setGroups([]);
          setTotal(0);
        }
      } finally {
        if (reqId === reqIdRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [trimmed, hasQuery, locale]);

  // Inline: close on outside click.
  useEffect(() => {
    if (isOverlay || !panelOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isOverlay, panelOpen]);

  // Global "/" — focus (inline) or open the palette (overlay).
  useEffect(() => {
    if (!enableShortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el?.isContentEditable
      )
        return;
      e.preventDefault();
      if (isOverlay) setOpen(true);
      else inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enableShortcut, isOverlay]);

  // Overlay: auto-focus input, lock body scroll, trap focus, Esc to close.
  useEffect(() => {
    if (!isOverlay || !open) return;

    const focusTimer = window.setTimeout(
      () => inputRef.current?.focus(),
      reduce ? 0 : 70,
    );

    const { body, documentElement } = document;
    const prevOverflow = body.style.overflow;
    const prevPad = body.style.paddingRight;
    const sbw = window.innerWidth - documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (sbw > 0) body.style.paddingRight = `${sbw}px`;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeOverlay();
        return;
      }
      if (e.key !== "Tab") return;
      const root = overlayRef.current;
      if (!root) return;
      const f = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      );
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);

    return () => {
      window.clearTimeout(focusTimer);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPad;
      document.removeEventListener("keydown", onKey, true);
    };
  }, [isOverlay, open, reduce, closeOverlay]);

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (isOverlay) closeOverlay();
      else {
        setOpen(false);
        inputRef.current?.blur();
      }
      return;
    }
    if (!panelOpen || flat.length === 0) {
      if (e.key === "ArrowDown" && hasQuery && !isOverlay) setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? flat.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (active >= 0 && flat[active]) {
        e.preventDefault();
        setOpen(false);
        router.push(flat[active].href);
      }
      // else: let the form submit → results page
    }
  }

  const sharedInputProps = {
    ref: inputRef,
    className: "catalog-search-input",
    type: "search" as const,
    name: "q",
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setValue(next);
      setOpen(true);
      if (next.trim().length < MIN_CHARS) clearResults();
    },
    onKeyDown: onInputKeyDown,
    placeholder: t("placeholder"),
    "aria-label": t("ariaLabel"),
    role: "combobox" as const,
    "aria-expanded": panelOpen,
    "aria-controls": listboxId,
    "aria-autocomplete": "list" as const,
    "aria-activedescendant":
      active >= 0 ? `${rootId}-opt-${active}` : undefined,
    autoComplete: "off" as const,
    spellCheck: false,
    enterKeyHint: "search" as const,
  };

  const inputStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    height: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    font: "inherit",
    color: "var(--color-text-strong)",
    letterSpacing: "-0.005em",
  };

  /* ---------------------------- OVERLAY ---------------------------- */
  if (isOverlay) {
    return (
      <>
        {/* Collapsed trigger — morphs into the palette via shared layoutId. */}
        {!open && (
          <motion.button
            ref={triggerRef}
            type="button"
            layoutId={barLayoutId}
            transition={layoutTransition}
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={t("ariaLabel")}
            style={{
              ...pillStyle(54, false),
              cursor: "text",
              textAlign: "left",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                width: 18,
                height: 18,
                flexShrink: 0,
              }}
            >
              <MagnifierIcon />
            </span>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 15,
                color: "var(--color-text-subtle)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {t("placeholder")}
            </span>
            <kbd
              className="catalog-search-kbd"
              aria-hidden
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                lineHeight: 1,
                color: "var(--color-text-subtle)",
                border: "1px solid var(--color-border)",
                borderRadius: 6,
                padding: "4px 7px",
                background: "var(--color-surface-2)",
              }}
            >
              /
            </kbd>
            <span
              aria-hidden
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                flexShrink: 0,
                borderRadius: 999,
                background: "var(--color-brand)",
                color: "white",
                boxShadow:
                  "0 8px 18px -8px color-mix(in oklab, var(--brand-teal) 65%, transparent)",
              }}
            >
              <Arrow size={15} />
            </span>
          </motion.button>
        )}

        {mounted &&
          createPortal(
            <>
              <AnimatePresence>
                {open && (
                  <motion.div
                    key="catalog-search-backdrop"
                    onClick={closeOverlay}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduce ? 0 : 0.2, ease: "easeOut" }}
                    style={{
                      position: "fixed",
                      inset: 0,
                      zIndex: 1000,
                      background: "rgba(0,0,0,0.2)",
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                    }}
                  />
                )}
              </AnimatePresence>

              {open && (
                <form
                  ref={overlayRef}
                  role="search"
                  onSubmit={(e) => {
                    e.preventDefault();
                    goToResults(value);
                  }}
                  style={{
                    position: "fixed",
                    top: "clamp(56px, 12vh, 128px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "min(672px, calc(100vw - 32px))",
                    zIndex: 1001,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <motion.div
                    layoutId={barLayoutId}
                    transition={layoutTransition}
                    role="dialog"
                    aria-modal="true"
                    aria-label={t("ariaLabel")}
                    style={pillStyle(60, true)}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        width: 18,
                        height: 18,
                        flexShrink: 0,
                      }}
                    >
                      {loading ? <Spinner /> : <MagnifierIcon />}
                    </span>
                    <input
                      {...sharedInputProps}
                      style={{ ...inputStyle, fontSize: 17 }}
                    />
                    <button
                      type="button"
                      onClick={closeOverlay}
                      aria-label={t("close")}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 38,
                        height: 38,
                        flexShrink: 0,
                        border: "1px solid var(--color-border)",
                        borderRadius: 999,
                        background: "var(--color-surface-2)",
                        color: "var(--color-text-muted)",
                        cursor: "pointer",
                      }}
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        aria-hidden
                      >
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: reduce ? 0 : -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: reduce ? 0 : 0.24,
                      ease: EASE,
                      delay: reduce ? 0 : 0.05,
                    }}
                    style={{
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--r-lg)",
                      boxShadow: "var(--shadow-xl)",
                      overflow: "hidden",
                    }}
                  >
                    <ResultsList
                      groups={groups}
                      total={total}
                      loading={loading}
                      trimmed={trimmed}
                      hasQuery={hasQuery}
                      active={active}
                      idle={!hasQuery}
                      idPrefix={rootId}
                      listboxId={listboxId}
                      ariaLabel={t("ariaLabel")}
                      maxHeight="min(60vh, 520px)"
                      t={t}
                      onActivate={setActive}
                      onSelect={() => setOpen(false)}
                    />
                  </motion.div>
                </form>
              )}
            </>,
            document.body,
          )}
      </>
    );
  }

  /* ---------------------------- INLINE ---------------------------- */
  return (
    <form
      ref={rootRef}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        goToResults(value);
      }}
      style={{ position: "relative", width: "100%" }}
    >
      <div style={pillStyle(54, focused)}>
        <span
          style={{
            display: "inline-flex",
            width: 18,
            height: 18,
            flexShrink: 0,
          }}
        >
          {loading ? <Spinner /> : <MagnifierIcon />}
        </span>

        <input
          {...sharedInputProps}
          autoFocus={autoFocus}
          onFocus={() => {
            setFocused(true);
            if (hasQuery) setOpen(true);
          }}
          onBlur={() => setFocused(false)}
          style={{ ...inputStyle, fontSize: 15 }}
        />

        {!focused && !value && (
          <kbd
            className="catalog-search-kbd"
            aria-hidden
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              lineHeight: 1,
              color: "var(--color-text-subtle)",
              border: "1px solid var(--color-border)",
              borderRadius: 6,
              padding: "4px 7px",
              background: "var(--color-surface-2)",
            }}
          >
            /
          </kbd>
        )}

        <motion.button
          type="submit"
          aria-label={t("submit")}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: "spring", stiffness: 420, damping: 24 }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            flexShrink: 0,
            border: "none",
            borderRadius: 999,
            background: "var(--color-brand)",
            color: "white",
            cursor: "pointer",
            boxShadow:
              "0 8px 18px -8px color-mix(in oklab, var(--brand-teal) 65%, transparent)",
          }}
        >
          <Arrow size={15} />
        </motion.button>
      </div>

      <AnimatePresence>
        {panelOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.985 }}
            transition={{ duration: 0.22, ease: EASE }}
            style={{
              position: "absolute",
              top: "calc(100% + 10px)",
              left: 0,
              right: 0,
              zIndex: 60,
              transformOrigin: "top center",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--r-lg)",
              boxShadow: "var(--shadow-xl)",
              overflow: "hidden",
            }}
          >
            <ResultsList
              groups={groups}
              total={total}
              loading={loading}
              trimmed={trimmed}
              hasQuery={hasQuery}
              active={active}
              idle={false}
              idPrefix={rootId}
              listboxId={listboxId}
              ariaLabel={t("ariaLabel")}
              maxHeight="min(58vh, 416px)"
              t={t}
              onActivate={setActive}
              onSelect={() => setOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
