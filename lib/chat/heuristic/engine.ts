/**
 * The heuristic chat provider — the default engine (no LLM required).
 *
 * Pipeline: detect script → resolve pending slot-filling (order/case/search) →
 * exact chip match → keyword intent match → auto-search fallback → compose a
 * structured, localized `ChatReply`. Every path returns helpful quick-replies
 * and, where useful, in-chat actions (login / add-to-cart / deep-link /
 * WhatsApp / capture-lead).
 */
import type { Locale } from "@/i18n/routing";
import type {
  ChatAction,
  ChatProvider,
  ChatReply,
  ChatState,
  ChatTurnContext,
  ChatTurnResult,
} from "../types";
import {
  CONTACT_INFO,
  LABELS,
  ROUTES,
  SAY,
  chipLabels,
  pick,
  type L,
} from "./content";
import {
  chipIntent,
  detectScript,
  extractEmail,
  extractReference,
  looksLikeSearch,
  matchIntent,
  normalize,
  searchAttempts,
  searchPhrase,
} from "./intents";
import { lookupCase, lookupOrder, searchCatalog } from "./tools";

/* ── Small reply builders ────────────────────────────────────────────────── */

const linkAction = (label: L, href: string, locale: Locale, primary = false) =>
  ({
    type: "link",
    label: pick(label, locale),
    href,
    variant: primary ? "primary" : "secondary",
  }) satisfies ChatAction;

const whatsappAction = (locale: Locale) =>
  ({
    type: "whatsapp",
    label: pick(LABELS.whatsapp, locale),
  }) satisfies ChatAction;

const leadAction = (locale: Locale) =>
  ({
    type: "capture_lead",
    label: pick(LABELS.leaveDetails, locale),
  }) satisfies ChatAction;

function say(key: keyof typeof SAY, locale: Locale): string {
  return pick(SAY[key], locale);
}

/* ── Intent handlers ─────────────────────────────────────────────────────── */

function reply(partial: ChatReply, intent: string): ChatReply {
  return { ...partial, intent };
}

function handleDivisions(locale: Locale): ChatTurnResult {
  return {
    reply: reply(
      {
        text: say("divisionsOverview", locale),
        actions: [
          linkAction(LABELS.browseMedtrade, ROUTES.medtrade, locale),
          linkAction(LABELS.shopKart, ROUTES.kart, locale, true),
          linkAction(LABELS.exploreAcademy, ROUTES.academy, locale),
          linkAction(LABELS.exploreDigihealth, ROUTES.digihealth, locale),
          linkAction(LABELS.exploreTourism, ROUTES.tourism, locale),
        ],
        suggestions: chipLabels(["medtrade", "trackOrder", "human"], locale),
      },
      "divisions",
    ),
    state: {},
  };
}

function simpleDivision(
  key: keyof typeof SAY,
  primaryLabel: L,
  href: string,
  intent: string,
  locale: Locale,
  suggestions: string[],
): ChatTurnResult {
  return {
    reply: reply(
      {
        text: say(key, locale),
        actions: [linkAction(primaryLabel, href, locale, true)],
        suggestions: chipLabels(suggestions, locale),
      },
      intent,
    ),
    state: {},
  };
}

function handleContact(locale: Locale): ChatTurnResult {
  const text = [
    say("contactIntro", locale),
    "",
    `📞 ${CONTACT_INFO.phone}`,
    `✉️ ${CONTACT_INFO.email}`,
    `📍 ${CONTACT_INFO.headOffice}`,
    "",
    say("contactOutro", locale),
  ].join("\n");
  return {
    reply: reply(
      {
        text,
        actions: [
          whatsappAction(locale),
          linkAction(LABELS.contactUs, ROUTES.contact, locale),
        ],
        suggestions: chipLabels(["human", "divisions"], locale),
      },
      "contact",
    ),
    state: {},
  };
}

function handleHuman(locale: Locale): ChatTurnResult {
  return {
    reply: reply(
      {
        text: say("humanHandoff", locale),
        handoff: true,
        actions: [whatsappAction(locale), leadAction(locale)],
        suggestions: chipLabels(["contact"], locale),
      },
      "human",
    ),
    state: {},
  };
}

function handleLogin(locale: Locale): ChatTurnResult {
  return {
    reply: reply(
      {
        text: say("loginPrompt", locale),
        actions: [{ type: "login", label: pick(LABELS.login, locale) }],
        suggestions: chipLabels(["trackOrder", "divisions"], locale),
      },
      "login",
    ),
    state: {},
  };
}

/* ── Slot-filling: order / case status ───────────────────────────────────── */

async function handleOrderSlot(
  raw: string,
  locale: Locale,
  state: ChatState | undefined,
): Promise<ChatTurnResult> {
  const email = extractEmail(raw) ?? state?.slots?.email;
  const ref = extractReference(raw) ?? state?.slots?.orderNumber;

  if (email && ref) {
    const card = await lookupOrder(ref, email, locale);
    if (card) {
      return {
        reply: reply(
          {
            text: say("orderFound", locale),
            cards: [card],
            actions: [whatsappAction(locale)],
            suggestions: chipLabels(["human", "shop"], locale),
          },
          "order_lookup",
        ),
        state: {},
      };
    }
    return {
      reply: reply(
        {
          text: say("orderNotFound", locale),
          handoff: true,
          actions: [whatsappAction(locale), leadAction(locale)],
          suggestions: chipLabels(["human"], locale),
        },
        "order_lookup",
      ),
      state: {},
    };
  }

  const hasPartial = Boolean(email || ref);
  return {
    reply: reply(
      { text: say(hasPartial ? "orderNeedBoth" : "orderAskDetails", locale) },
      "order_lookup",
    ),
    state: {
      pendingIntent: "order_lookup",
      slots: {
        ...(email ? { email } : {}),
        ...(ref ? { orderNumber: ref } : {}),
      },
    },
  };
}

async function handleCaseSlot(
  raw: string,
  locale: Locale,
  state: ChatState | undefined,
): Promise<ChatTurnResult> {
  const email = extractEmail(raw) ?? state?.slots?.email;
  const ref = extractReference(raw) ?? state?.slots?.caseNumber;

  if (email && ref) {
    const card = await lookupCase(ref, email, locale);
    if (card) {
      return {
        reply: reply(
          {
            text: say("caseFound", locale),
            cards: [card],
            actions: [
              linkAction(LABELS.contactUs, ROUTES.contact, locale),
              whatsappAction(locale),
            ],
            suggestions: chipLabels(["tourism", "human"], locale),
          },
          "case_lookup",
        ),
        state: {},
      };
    }
    return {
      reply: reply(
        {
          text: say("caseNotFound", locale),
          handoff: true,
          actions: [whatsappAction(locale)],
          suggestions: chipLabels(["human"], locale),
        },
        "case_lookup",
      ),
      state: {},
    };
  }

  const hasPartial = Boolean(email || ref);
  return {
    reply: reply(
      { text: say(hasPartial ? "orderNeedBoth" : "caseAskDetails", locale) },
      "case_lookup",
    ),
    state: {
      pendingIntent: "case_lookup",
      slots: {
        ...(email ? { email } : {}),
        ...(ref ? { caseNumber: ref } : {}),
      },
    },
  };
}

/* ── Product search ──────────────────────────────────────────────────────── */

/**
 * Intents that often arrive with a product named in the same breath. For these
 * a matching product is a better answer than the intent's canned reply.
 */
const PRODUCT_SEEKING_INTENTS = new Set(["how_to_order"]);

/**
 * Find what the message is actually asking about. The conversational wrapper
 * is stripped first, because the catalogue matcher requires every term to
 * appear in a product, then progressively relaxed until something matches.
 */
async function findProducts(text: string, locale: Locale) {
  const phrase = searchPhrase(normalize(text));
  for (const query of searchAttempts(phrase)) {
    const found = await searchCatalog(query, locale);
    if (found.cards.length > 0) return { ...found, query };
  }
  return { cards: [], total: 0, query: phrase };
}

/**
 * Answer with catalogue results, or null when nothing matched so the caller
 * can fall through to its own reply.
 */
async function productSearch(
  text: string,
  locale: Locale,
): Promise<ChatTurnResult | null> {
  if (!looksLikeSearch(searchPhrase(normalize(text)))) return null;
  const res = await runSearch(text, locale);
  return res.reply.cards && res.reply.cards.length > 0 ? res : null;
}

async function runSearch(
  text: string,
  locale: Locale,
): Promise<ChatTurnResult> {
  const { cards, total, query } = await findProducts(text, locale);
  if (cards.length === 0) {
    return {
      reply: reply(
        {
          text: say("searchNoResults", locale),
          actions: [
            linkAction(
              LABELS.requestProduct,
              ROUTES.requestProduct,
              locale,
              true,
            ),
            whatsappAction(locale),
          ],
          suggestions: chipLabels(["divisions", "human"], locale),
        },
        "product_search",
      ),
      state: {},
    };
  }
  const actions: ChatAction[] =
    total > cards.length
      ? [
          {
            type: "link",
            label: pick(LABELS.viewAll, locale),
            href: `${ROUTES.kartShop}?q=${encodeURIComponent(query)}`,
            variant: "secondary",
          },
        ]
      : [];
  return {
    reply: reply(
      {
        text: say("searchResults", locale),
        cards,
        actions,
        suggestions: chipLabels(["quotation", "human"], locale),
      },
      "product_search",
    ),
    state: {},
  };
}

/* ── Dispatch ────────────────────────────────────────────────────────────── */

async function dispatch(
  intent: string,
  raw: string,
  normalized: string,
  locale: Locale,
): Promise<ChatTurnResult> {
  switch (intent) {
    case "greeting":
      return {
        reply: reply(
          {
            text: say("greeting", locale),
            suggestions: chipLabels(
              ["divisions", "shop", "courses", "trackOrder", "human"],
              locale,
            ),
          },
          "greeting",
        ),
        state: {},
      };
    case "thanks":
      return {
        reply: reply(
          {
            text: say("thanks", locale),
            suggestions: chipLabels(["divisions", "human"], locale),
          },
          "thanks",
        ),
        state: {},
      };
    case "divisions":
      return handleDivisions(locale);
    case "medtrade":
      return simpleDivision(
        "medtrade",
        LABELS.browseMedtrade,
        ROUTES.medtrade,
        "medtrade",
        locale,
        ["quotation", "shop"],
      );
    case "kart":
      return simpleDivision(
        "kart",
        LABELS.shopKart,
        ROUTES.kart,
        "kart",
        locale,
        ["medtrade", "trackOrder"],
      );
    case "academy":
      return simpleDivision(
        "academy",
        LABELS.exploreAcademy,
        ROUTES.academy,
        "academy",
        locale,
        ["divisions", "human"],
      );
    case "digihealth":
      return simpleDivision(
        "digihealth",
        LABELS.exploreDigihealth,
        ROUTES.digihealth,
        "digihealth",
        locale,
        ["divisions", "quotation"],
      );
    case "tourism":
      return {
        reply: reply(
          {
            text: say("tourism", locale),
            actions: [
              linkAction(LABELS.exploreTourism, ROUTES.tourism, locale, true),
              linkAction(
                LABELS.bookConsultation,
                ROUTES.tourismConsult,
                locale,
              ),
            ],
            suggestions: chipLabels(["contact", "human"], locale),
          },
          "tourism",
        ),
        state: {},
      };
    case "healthCorner":
      return simpleDivision(
        "healthCorner",
        LABELS.aboutUs,
        ROUTES.about,
        "healthCorner",
        locale,
        ["divisions", "human"],
      );
    case "blog":
      return simpleDivision(
        "blog",
        LABELS.readBlog,
        ROUTES.blog,
        "blog",
        locale,
        ["divisions"],
      );
    case "about":
      return simpleDivision(
        "aboutCompany",
        LABELS.aboutUs,
        ROUTES.about,
        "about",
        locale,
        ["divisions", "contact"],
      );
    case "contact":
      return handleContact(locale);
    case "hours":
      return {
        reply: reply(
          {
            text: say("hours", locale),
            actions: [whatsappAction(locale), leadAction(locale)],
            suggestions: chipLabels(["contact", "human"], locale),
          },
          "hours",
        ),
        state: {},
      };
    case "shipping":
      return simpleDivision(
        "shipping",
        LABELS.shopKart,
        ROUTES.kart,
        "shipping",
        locale,
        ["trackOrder", "human"],
      );
    case "returns":
      return {
        reply: reply(
          {
            text: say("returns", locale),
            actions: [
              {
                type: "quick_reply",
                label: pick(LABELS.trackOrder, locale),
                send: pick(LABELS.trackOrder, locale),
              },
              whatsappAction(locale),
            ],
            suggestions: chipLabels(["human", "contact"], locale),
          },
          "returns",
        ),
        state: {},
      };
    case "payment":
      return {
        reply: reply(
          {
            text: say("payment", locale),
            suggestions: chipLabels(["shop", "human"], locale),
          },
          "payment",
        ),
        state: {},
      };
    case "how_to_order":
      return {
        reply: reply(
          {
            text: say("howToOrder", locale),
            actions: [linkAction(LABELS.shopKart, ROUTES.kart, locale, true)],
            suggestions: chipLabels(["trackOrder", "human"], locale),
          },
          "how_to_order",
        ),
        state: {},
      };
    case "quotation":
      return {
        reply: reply(
          {
            text: say("howToRfq", locale),
            actions: [
              linkAction(LABELS.browseMedtrade, ROUTES.medtrade, locale, true),
            ],
            suggestions: chipLabels(["medtrade", "human"], locale),
          },
          "quotation",
        ),
        state: {},
      };
    case "request_product":
      return {
        reply: reply(
          {
            text: say("requestProduct", locale),
            actions: [
              linkAction(
                LABELS.requestProduct,
                ROUTES.requestProduct,
                locale,
                true,
              ),
            ],
            suggestions: chipLabels(["shop", "human"], locale),
          },
          "request_product",
        ),
        state: {},
      };
    case "become_seller":
      return {
        reply: reply(
          {
            text: say("becomeSeller", locale),
            actions: [
              linkAction(
                LABELS.becomeSeller,
                ROUTES.becomeSeller,
                locale,
                true,
              ),
            ],
            suggestions: chipLabels(["shop", "human"], locale),
          },
          "become_seller",
        ),
        state: {},
      };
    case "login":
      return handleLogin(locale);
    case "order_lookup":
      return handleOrderSlot(raw, locale, undefined);
    case "case_lookup":
      return handleCaseSlot(raw, locale, undefined);
    case "human":
      return handleHuman(locale);
    case "product_search": {
      if (searchPhrase(normalize(raw)).length >= 3) {
        return runSearch(raw, locale);
      }
      return {
        reply: reply({ text: say("searchAsk", locale) }, "product_search"),
        state: { pendingIntent: "product_search" },
      };
    }
    default:
      return handleFallback(locale);
  }
}

function handleFallback(locale: Locale): ChatTurnResult {
  return {
    reply: reply(
      {
        text: say("fallback", locale),
        actions: [whatsappAction(locale), leadAction(locale)],
        suggestions: chipLabels(
          ["divisions", "shop", "trackOrder", "human"],
          locale,
        ),
      },
      "fallback",
    ),
    state: {},
  };
}

/* ── Provider ────────────────────────────────────────────────────────────── */

async function respond(
  message: string,
  ctx: ChatTurnContext,
): Promise<ChatTurnResult> {
  const raw = message.trim().slice(0, 500);
  if (!raw) {
    return dispatch("greeting", raw, "", ctx.locale);
  }
  // Reply in the language the user is typing (script beats the site locale).
  const locale: Locale = detectScript(raw) ?? ctx.locale;
  const normalized = normalize(raw);
  const pending = ctx.state?.pendingIntent;

  // 1) Resolve an in-flight slot-filling flow, unless the user clearly pivots
  //    to a different strong intent.
  const strong = matchIntent(normalized);
  const pivots = strong && strong.score >= 2 && strong.intent !== pending;

  if (pending === "order_lookup" && !pivots) {
    return handleOrderSlot(raw, locale, ctx.state);
  }
  if (pending === "case_lookup" && !pivots) {
    return handleCaseSlot(raw, locale, ctx.state);
  }
  if (pending === "product_search" && !pivots) {
    return runSearch(raw, locale);
  }

  // 2) A clicked quick-reply chip maps exactly to its intent.
  const chip = chipIntent(normalized);
  if (chip) return dispatch(chip, raw, normalized, locale);

  // 3) Keyword intent match. "How do I buy a blood pressure monitor" is a
  //    product question wearing an ordering wrapper, so when an ordering intent
  //    matches AND the message names something we stock, show the product
  //    rather than a generic explanation of how checkout works.
  if (strong) {
    if (PRODUCT_SEEKING_INTENTS.has(strong.intent)) {
      const found = await productSearch(raw, locale);
      if (found) return found;
    }
    return dispatch(strong.intent, raw, normalized, locale);
  }

  // 4) No intent — if it reads like a product noun-phrase, try a catalog search.
  const found = await productSearch(raw, locale);
  if (found) return found;

  // 5) Fallback with helpful chips.
  return handleFallback(locale);
}

export const heuristicProvider: ChatProvider = {
  id: "heuristic",
  respond,
};
