"use client";

/**
 * Spiber Med chat assistant — a floating bottom-right widget.
 *
 * Talks to POST /api/chat (heuristic engine by default; LLM drop-in via env)
 * and renders the structured reply: text, product/course/order cards, action
 * buttons (open login, add-to-cart, deep-link, WhatsApp, capture-lead) and
 * quick-reply chips. Transcript persists in an external store (localStorage).
 *
 * State that comes from storage is read via that store's `useSyncExternalStore`
 * so we never set state in an effect (the repo's React-Compiler lint); the only
 * effects here are DOM-only (focus, autoscroll, Escape) and event wiring.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useTranslations, useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  MessageCircle,
  X,
  SendHorizontal,
  Loader2,
  ShoppingCart,
  Check,
  ArrowUpRight,
  ImageOff,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useAuthModal } from "@/components/auth/auth-modal";
import { useCart } from "@/components/shop/use-cart";
import { startRouteOverlay } from "@/components/layout/route-transition-overlay";
import type { ChatAction, ChatCard, ChatReply } from "@/lib/chat/types";
import {
  addBotMessage,
  addUserMessage,
  getChatState,
  getConversationId,
  getServerSnapshot,
  getSnapshot,
  setConversation,
  setOpen,
  subscribe,
  toggleOpen,
} from "./chat-store";

const WHATSAPP_NUMBER = "8801346092798";
const EASE = [0.16, 1, 0.3, 1] as const;

function waUrl(text: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** The actual two-tone WhatsApp mark (brand green bubble + white handset). */
function WhatsAppGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fill="#25D366"
        d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2z"
      />
      <path
        fill="#FFFFFF"
        d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.8.37-.27.3-1.05 1.02-1.05 2.5 0 1.47 1.07 2.89 1.22 3.09.15.2 2.11 3.22 5.1 4.51.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z"
      />
    </svg>
  );
}

/* ── Styles (inline, design-token driven) ────────────────────────────────── */

const Z = 90;

const launcherStyle: React.CSSProperties = {
  position: "fixed",
  right: "clamp(16px, 4vw, 24px)",
  bottom: "clamp(16px, 4vw, 24px)",
  zIndex: Z,
  width: 60,
  height: 60,
  borderRadius: "var(--r-pill)",
  border: "none",
  cursor: "pointer",
  background: "var(--color-brand)",
  color: "#fff",
  display: "grid",
  placeItems: "center",
  boxShadow: "0 10px 30px -6px rgba(13,143,145,0.55), var(--shadow-lg)",
};

const panelStyle: React.CSSProperties = {
  position: "fixed",
  right: "clamp(12px, 4vw, 24px)",
  bottom: "clamp(12px, 4vw, 24px)",
  zIndex: Z,
  width: "min(400px, calc(100vw - 24px))",
  height: "min(640px, calc(100dvh - 96px))",
  display: "flex",
  flexDirection: "column",
  background: "var(--color-surface)",
  borderRadius: "var(--r-xl)",
  overflow: "hidden",
  boxShadow: "var(--shadow-xl)",
  border: "1px solid var(--color-hairline)",
};

const bodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "var(--s-4)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--s-3)",
  background: "var(--color-bg)",
};

/* ── Subcomponents ───────────────────────────────────────────────────────── */

function CardImage({ src }: { src?: string | null }) {
  if (!src) {
    return (
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: "var(--r-sm)",
          background: "var(--color-brand-soft)",
          color: "var(--color-brand)",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <ImageOff size={16} aria-hidden />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      style={{
        width: 46,
        height: 46,
        borderRadius: "var(--r-sm)",
        objectFit: "cover",
        flexShrink: 0,
        background: "var(--color-surface-2)",
      }}
    />
  );
}

function CardRow({ card }: { card: ChatCard }) {
  const inner = (
    <>
      <CardImage src={card.image} />
      <span
        style={{
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        {card.meta && (
          <span
            style={{
              fontSize: 10,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              color: "var(--color-brand-deep)",
              fontWeight: 600,
            }}
          >
            {card.meta}
          </span>
        )}
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: "var(--color-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {card.title}
        </span>
        {card.subtitle && (
          <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
            {card.subtitle}
          </span>
        )}
      </span>
    </>
  );

  const shell: React.CSSProperties = {
    display: "flex",
    gap: "var(--s-3)",
    alignItems: "center",
    padding: "var(--s-2)",
    background: "var(--color-surface)",
    border: "1px solid var(--color-hairline)",
    borderRadius: "var(--r-md)",
    textDecoration: "none",
  };

  return card.href ? (
    <Link href={card.href} onClick={() => startRouteOverlay()} style={shell}>
      {inner}
      <ArrowUpRight
        size={15}
        style={{ color: "var(--color-text-muted)", flexShrink: 0 }}
        aria-hidden
      />
    </Link>
  ) : (
    <div style={shell}>{inner}</div>
  );
}

function AddToCartButton({
  action,
  label,
}: {
  action: Extract<ChatAction, { type: "add_to_cart" }>;
  label: string;
}) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        add.mutate(
          {
            productId: action.productId,
            variantId: action.variantId ?? undefined,
          },
          { onSuccess: () => setAdded(true) },
        )
      }
      disabled={added || add.isPending}
      style={{
        ...actionBtnStyle(true),
        opacity: added ? 0.9 : 1,
      }}
    >
      {added ? (
        <Check size={14} aria-hidden />
      ) : (
        <ShoppingCart size={14} aria-hidden />
      )}
      {added ? label : action.label}
    </button>
  );
}

function actionBtnStyle(primary: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 12px",
    borderRadius: "var(--r-pill)",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    border: primary ? "none" : "1px solid var(--color-border)",
    background: primary ? "var(--color-brand)" : "var(--color-surface)",
    color: primary ? "#fff" : "var(--color-brand-deep)",
    textDecoration: "none",
    lineHeight: 1.2,
  };
}

/* ── Main widget ─────────────────────────────────────────────────────────── */

export function ChatWidget() {
  const t = useTranslations("chat");
  const locale = useLocale();
  const pathname = usePathname();
  const reduce = useReducedMotion() ?? false;
  const { open: openAuthModal } = useAuthModal();

  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { open, messages } = snap;

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const starters = useMemo(() => {
    const raw = t.raw("starters");
    return Array.isArray(raw) ? (raw as string[]) : [];
  }, [t]);

  // DOM-only effects (no setState) — lint-safe.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, sending, open, leadOpen]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const errorReply = useCallback(
    (): ChatReply => ({
      text: t("error"),
      actions: [{ type: "whatsapp", label: t("whatsapp") }],
    }),
    [t],
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;
      setLeadOpen(false);
      setInput("");
      addUserMessage(trimmed);
      setSending(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            conversationId: getConversationId() ?? undefined,
            locale,
            path: pathname,
            state: getChatState(),
          }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.ok) {
          setConversation(json.data.conversationId, json.data.state ?? {});
          addBotMessage(json.data.reply as ChatReply);
        } else {
          addBotMessage(errorReply());
        }
      } catch {
        addBotMessage(errorReply());
      } finally {
        setSending(false);
      }
    },
    [sending, locale, pathname, errorReply],
  );

  const renderAction = useCallback(
    (action: ChatAction, key: number) => {
      switch (action.type) {
        case "link":
          return (
            <Link
              key={key}
              href={action.href}
              onClick={() => startRouteOverlay()}
              style={actionBtnStyle(action.variant === "primary")}
            >
              {action.label}
              <ArrowUpRight size={13} aria-hidden />
            </Link>
          );
        case "login":
          return (
            <button
              key={key}
              type="button"
              onClick={() => openAuthModal("login", { next: pathname })}
              style={actionBtnStyle(true)}
            >
              {action.label}
            </button>
          );
        case "whatsapp":
          return (
            <a
              key={key}
              href={waUrl(action.text ?? t("whatsappPrefill"))}
              target="_blank"
              rel="noreferrer"
              style={{
                ...actionBtnStyle(false),
                color: "#075e54",
                background: "#effaf1",
                borderColor: "#bfe6cd",
              }}
            >
              <WhatsAppGlyph size={15} />
              {action.label}
            </a>
          );
        case "capture_lead":
          return (
            <button
              key={key}
              type="button"
              onClick={() => setLeadOpen(true)}
              style={actionBtnStyle(false)}
            >
              {action.label}
            </button>
          );
        case "add_to_cart":
          return (
            <AddToCartButton
              key={key}
              action={action}
              label={t("addedToCart")}
            />
          );
        case "quick_reply":
          return (
            <button
              key={key}
              type="button"
              onClick={() => send(action.send)}
              style={actionBtnStyle(false)}
            >
              {action.label}
            </button>
          );
        default:
          return null;
      }
    },
    [openAuthModal, pathname, send, t],
  );

  const renderBot = useCallback(
    (reply: ChatReply, key: string) => (
      <div
        key={key}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--s-2)",
          maxWidth: "92%",
        }}
      >
        <div
          style={{
            alignSelf: "flex-start",
            background: "var(--color-surface)",
            border: "1px solid var(--color-hairline)",
            color: "var(--color-text)",
            padding: "10px 13px",
            borderRadius: "4px 16px 16px 16px",
            fontSize: 14,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
          }}
        >
          {reply.text}
        </div>
        {reply.cards && reply.cards.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {reply.cards.map((c, i) => (
              <div
                key={i}
                style={{ display: "flex", flexDirection: "column", gap: 6 }}
              >
                <CardRow card={c} />
                {c.actions && c.actions.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {c.actions.map((a, j) => renderAction(a, j))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {reply.actions && reply.actions.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {reply.actions.map((a, i) => renderAction(a, i))}
          </div>
        )}
        {reply.suggestions && reply.suggestions.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {reply.suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => send(s)}
                style={{
                  padding: "6px 11px",
                  borderRadius: "var(--r-pill)",
                  border: "1px solid var(--color-brand)",
                  background: "var(--color-brand-soft)",
                  color: "var(--color-brand-deep)",
                  fontSize: 12.5,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    ),
    [renderAction, send],
  );

  const panelMotion = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 24, scale: 0.96 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 24, scale: 0.97 },
        transition: { duration: 0.28, ease: EASE },
      };

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            type="button"
            onClick={toggleOpen}
            aria-label={t("launcherOpen")}
            style={launcherStyle}
            initial={reduce ? undefined : { scale: 0, opacity: 0 }}
            animate={reduce ? undefined : { scale: 1, opacity: 1 }}
            exit={reduce ? undefined : { scale: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            whileHover={reduce ? undefined : { scale: 1.05 }}
            whileTap={reduce ? undefined : { scale: 0.95 }}
          >
            <MessageCircle size={26} aria-hidden />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={t("title")}
            style={panelStyle}
            {...panelMotion}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--s-3)",
                padding: "var(--s-3) var(--s-4)",
                background:
                  "linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-deep) 100%)",
                color: "#fff",
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "var(--r-pill)",
                  background: "rgba(255,255,255,0.16)",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <MessageCircle size={20} aria-hidden />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>
                  {t("title")}
                </div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  {t("subtitle")}
                </div>
              </div>
              <a
                href={waUrl(t("whatsappPrefill"))}
                target="_blank"
                rel="noreferrer"
                aria-label={t("whatsapp")}
                title={t("whatsapp")}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "var(--r-pill)",
                  background: "#fff",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                }}
              >
                <WhatsAppGlyph size={22} />
              </a>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("close")}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "var(--r-pill)",
                  background: "transparent",
                  border: "none",
                  color: "#fff",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <X size={19} aria-hidden />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} style={bodyStyle} aria-live="polite">
              {messages.length === 0 &&
                renderBot(
                  { text: t("greeting"), suggestions: starters },
                  "greeting",
                )}

              {messages.map((m) =>
                m.role === "user" ? (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: "flex-end",
                      maxWidth: "88%",
                      background: "var(--color-brand)",
                      color: "#fff",
                      padding: "10px 13px",
                      borderRadius: "16px 4px 16px 16px",
                      fontSize: 14,
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {m.text}
                  </div>
                ) : (
                  renderBot(m.reply ?? { text: m.text }, m.id)
                ),
              )}

              {sending && (
                <div
                  style={{
                    alignSelf: "flex-start",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-hairline)",
                    padding: "10px 13px",
                    borderRadius: "4px 16px 16px 16px",
                    color: "var(--color-text-muted)",
                    fontSize: 13,
                  }}
                >
                  <Loader2 size={15} className="animate-spin" aria-hidden />
                  {t("typing")}
                </div>
              )}

              {leadOpen && (
                <LeadForm
                  locale={locale}
                  onCancel={() => setLeadOpen(false)}
                  onSubmitted={() => {
                    setLeadOpen(false);
                    addBotMessage({ text: t("lead.success") });
                  }}
                />
              )}
            </div>

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              style={{
                display: "flex",
                gap: "var(--s-2)",
                padding: "var(--s-3)",
                borderTop: "1px solid var(--color-hairline)",
                background: "var(--color-surface)",
                alignItems: "center",
              }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("inputPlaceholder")}
                maxLength={500}
                aria-label={t("inputPlaceholder")}
                style={{
                  flex: 1,
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--r-pill)",
                  padding: "10px 16px",
                  fontSize: 15,
                  outline: "none",
                  background: "var(--color-bg)",
                  color: "var(--color-text)",
                  minWidth: 0,
                }}
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                aria-label={t("send")}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "var(--r-pill)",
                  border: "none",
                  background: "var(--color-brand)",
                  color: "#fff",
                  cursor: input.trim() && !sending ? "pointer" : "not-allowed",
                  opacity: input.trim() && !sending ? 1 : 0.5,
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <SendHorizontal size={18} aria-hidden />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ── Lead capture form ───────────────────────────────────────────────────── */

function LeadForm({
  locale,
  onSubmitted,
  onCancel,
}: {
  locale: string;
  onSubmitted: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("chat.lead");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fieldStyle: React.CSSProperties = {
    border: "1px solid var(--color-border)",
    borderRadius: "var(--r-sm)",
    padding: "9px 12px",
    fontSize: 14,
    outline: "none",
    background: "var(--color-surface)",
    color: "var(--color-text)",
    width: "100%",
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim() || !email.trim()) {
      setError(t("required"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: getConversationId() ?? undefined,
          name,
          email,
          phone: phone || undefined,
          message: message || undefined,
          locale,
          website,
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        onSubmitted();
      } else {
        setError(t("failed"));
      }
    } catch {
      setError(t("failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      style={{
        alignSelf: "stretch",
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-2)",
        background: "var(--color-surface)",
        border: "1px solid var(--color-hairline)",
        borderRadius: "var(--r-md)",
        padding: "var(--s-3)",
      }}
    >
      <div
        style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-text)" }}
      >
        {t("title")}
      </div>
      <input
        aria-label={t("name")}
        placeholder={t("name")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={120}
        required
        style={fieldStyle}
      />
      <input
        aria-label={t("email")}
        type="email"
        placeholder={t("email")}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        maxLength={200}
        required
        style={fieldStyle}
      />
      <input
        aria-label={t("phone")}
        placeholder={t("phone")}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        maxLength={40}
        style={fieldStyle}
      />
      <textarea
        aria-label={t("message")}
        placeholder={t("message")}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={2000}
        rows={2}
        style={{ ...fieldStyle, resize: "vertical" }}
      />
      {/* Honeypot — visually hidden, off-screen */}
      <input
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        style={{
          position: "absolute",
          left: "-9999px",
          width: 1,
          height: 1,
          opacity: 0,
        }}
        aria-hidden
      />
      {error && (
        <div style={{ fontSize: 12.5, color: "var(--color-danger, #c0392b)" }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", gap: "var(--s-2)" }}>
        <button
          type="submit"
          disabled={busy}
          style={{ ...actionBtnStyle(true), flex: 1, justifyContent: "center" }}
        >
          {busy ? (
            <Loader2 size={14} className="animate-spin" aria-hidden />
          ) : null}
          {busy ? t("sending") : t("submit")}
        </button>
        <button type="button" onClick={onCancel} style={actionBtnStyle(false)}>
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
