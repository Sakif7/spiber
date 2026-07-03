/**
 * Shared chat types — deliberately free of any server imports (no Mongoose, no
 * repositories) so the client widget can import them without dragging server
 * code into the browser bundle (mirrors `lib/search/dto.ts`).
 *
 * The bot returns a STRUCTURED, already-localized reply so the widget can render
 * product cards, action buttons (open login / add-to-cart / deep-link /
 * WhatsApp / capture-lead) and quick-reply chips — real in-chat actions, not
 * just text. Everything is resolved to the request locale server-side.
 */
import type { Locale } from "@/i18n/routing";

export type ChatRole = "user" | "bot";

/**
 * A render-ready action attached to a bot reply. `label` is already localized.
 * `quick_reply.send` is posted back verbatim as the next user message, so it
 * flows through the same intent matcher as typed input (clicked === typed).
 */
export type ChatAction =
  | {
      type: "link";
      label: string;
      /** Locale-relative path, rendered with the i18n `Link` (auto-prefixed). */
      href: string;
      variant?: "primary" | "secondary";
    }
  | { type: "login"; label: string }
  | {
      type: "add_to_cart";
      label: string;
      productId: string;
      variantId?: string | null;
    }
  | { type: "whatsapp"; label: string; text?: string }
  | { type: "capture_lead"; label: string }
  | { type: "quick_reply"; label: string; send: string };

export type ChatCardKind =
  | "product"
  | "course"
  | "software"
  | "post"
  | "order"
  | "case";

/** A compact card (product / course / order status …), fully pre-formatted. */
export type ChatCard = {
  kind: ChatCardKind;
  title: string;
  /** Pre-formatted secondary line (price / reading time / status). */
  subtitle?: string;
  image?: string | null;
  /** Locale-relative detail path. */
  href?: string;
  /** Tiny label above the title (division / group). */
  meta?: string;
  actions?: ChatAction[];
};

/** The structured reply a provider returns for one turn — fully localized. */
export type ChatReply = {
  text: string;
  cards?: ChatCard[];
  actions?: ChatAction[];
  /** Quick-reply chip labels; each is posted back verbatim on click. */
  suggestions?: string[];
  /** Intent id (for analytics / admin triage). */
  intent?: string;
  /** Ask the widget to reveal the lead-capture form. */
  captureLead?: boolean;
  /** Suggest a human/WhatsApp handoff (widget highlights the WA button). */
  handoff?: boolean;
};

/**
 * Lightweight per-conversation state the engine carries between turns for slot
 * filling (e.g. "track order" → collect order number + email). Persisted on the
 * conversation and echoed back to the client so the next request replays it.
 */
export type ChatState = {
  pendingIntent?: string | null;
  slots?: Record<string, string>;
};

/** Context passed into a provider for a single turn. */
export type ChatTurnContext = {
  locale: Locale;
  /** Current page path (locale-stripped) so replies can be context-aware. */
  path?: string;
  loggedIn?: boolean;
  state?: ChatState;
};

/** What a provider returns for one turn. */
export type ChatTurnResult = {
  reply: ChatReply;
  /** Updated state to persist + replay next turn. */
  state?: ChatState;
};

/**
 * The pluggable chat engine seam (mirrors `PaymentProvider` / `VideoProvider`).
 * The heuristic engine is the default; an LLM (Claude) provider drops in via
 * `CHAT_PROVIDER` with zero wiring changes — it consumes the same tool registry.
 */
export interface ChatProvider {
  readonly id: string;
  respond(message: string, ctx: ChatTurnContext): Promise<ChatTurnResult>;
}

/* ── Wire DTOs (client ⇄ /api/chat) ─────────────────────────────────────── */

export type ChatRequestDTO = {
  message: string;
  conversationId?: string;
  locale?: string;
  path?: string;
  state?: ChatState;
};

export type ChatResponseDTO = {
  conversationId: string;
  reply: ChatReply;
  state?: ChatState;
};
