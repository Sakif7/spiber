/**
 * Heuristic intent matching for the chat engine. No ML — a transparent,
 * per-locale keyword scorer plus a few extractors (email, order/case reference,
 * script detection). Clicked quick-reply chips are matched exactly (same path
 * as typed text), so "clicked === typed".
 */
import type { Locale } from "@/i18n/routing";
import { CHIPS, pick } from "./content";

/* ── Text utilities ──────────────────────────────────────────────────────── */

/**
 * Lowercase + collapse whitespace; keeps letters (incl. Bangla/CJK), digits and
 * combining marks. `\p{M}` is essential — Bangla vowel signs / virama are marks,
 * and dropping them mangles words so keywords stop matching.
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s@.+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BANGLA = /[ঀ-৿]/;
const JAPANESE = /[぀-ヿ一-鿿ｦ-ﾝ]/;
const LATIN = /[a-z]/i;

/** Detect the script the user is typing in (overrides the site locale). */
export function detectScript(text: string): Locale | null {
  if (JAPANESE.test(text)) return "ja";
  if (BANGLA.test(text)) return "bn";
  return null;
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

export function extractEmail(text: string): string | null {
  const m = text.match(EMAIL_RE);
  return m ? m[0].toLowerCase() : null;
}

/**
 * A reference token: our ids look like `SPM-CASE-LZ4K-0Q2X9`. Match an
 * alphanumeric-with-dashes token that contains a digit and is reasonably long,
 * so a plain word isn't mistaken for a reference.
 */
const REF_RE = /\b([A-Z]{2,}(?:-[A-Z0-9]{2,}){1,4})\b/i;

export function extractReference(text: string): string | null {
  const m = text.toUpperCase().match(REF_RE);
  if (!m) return null;
  const token = m[1];
  return /\d/.test(token) && token.length >= 5 ? token : null;
}

/* ── Whole-word / substring keyword match ────────────────────────────────── */

function containsKeyword(haystack: string, kw: string): boolean {
  // Latin keywords match on word boundaries (avoids "or" inside "order");
  // Bangla/CJK have no spaces between words, so substring is correct there.
  if (LATIN.test(kw)) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}])${escaped}([^\\p{L}]|$)`, "u").test(
      haystack,
    );
  }
  return haystack.includes(kw);
}

/**
 * Intent keyword table. English is richest; the main intents also carry Bangla
 * and Japanese terms. `strong` keywords weigh double (a decisive signal).
 */
type IntentDef = {
  id: string;
  kw: string[];
  strong?: string[];
};

const INTENTS: IntentDef[] = [
  {
    id: "greeting",
    kw: [
      "hi",
      "hello",
      "hey",
      "assalamu",
      "salam",
      "নমস্কার",
      "হ্যালো",
      "হাই",
      "আসসালামু",
      "こんにちは",
      "はじめまして",
      "やあ",
    ],
  },
  {
    id: "thanks",
    kw: [
      "thanks",
      "thank you",
      "thx",
      "ধন্যবাদ",
      "থ্যাংকস",
      "ありがとう",
      "感謝",
    ],
  },
  {
    id: "divisions",
    kw: [
      "what do you",
      "what do you offer",
      "what do you sell",
      "services",
      "divisions",
      "about your business",
      "everything",
      "overview",
      "কী অফার",
      "কি অফার",
      "কী বিক্রি",
      "সেবা",
      "বিভাগ",
      "取扱い",
      "サービス",
      "事業",
      "何を",
    ],
    strong: ["divisions", "what do you offer", "বিভাগ", "事業"],
  },
  {
    id: "medtrade",
    kw: [
      "medtrade",
      "medical device",
      "medical devices",
      "instrument",
      "instruments",
      "hospital equipment",
      "imaging",
      "patient monitor",
      "monitoring",
      "critical care",
      "surgical",
      "operating",
      "lab equipment",
      "diagnostic",
      "মেডট্রেড",
      "মেডিকেল ডিভাইস",
      "যন্ত্র",
      "হাসপাতাল সরঞ্জাম",
      "医療機器",
      "機器",
      "病院設備",
      "手術",
    ],
    strong: [
      "medtrade",
      "medical device",
      "medical devices",
      "মেডিকেল ডিভাইস",
      "医療機器",
    ],
  },
  {
    id: "kart",
    kw: [
      "kart",
      "marketplace",
      "shop",
      "store",
      "buy online",
      "online shop",
      "products to buy",
      "cart",
      "কার্ট",
      "মার্কেটপ্লেস",
      "কেনাকাটা",
      "দোকান",
      "কার্ট",
      "マーケット",
      "ショップ",
      "通販",
      "オンライン",
    ],
    strong: ["kart", "marketplace", "মার্কেটপ্লেস", "マーケット"],
  },
  {
    id: "academy",
    kw: [
      // Latin keywords match on word boundaries, so the new brand name needs its
      // own entry — "medacademy" does not match the bare "academy" keyword. The
      // legacy name stays: visitors still say "academy". (Bangla matches by
      // substring, so "মেডএকাডেমি" already hits "একাডেমি".)
      "medacademy",
      "med academy",
      "academy",
      "course",
      "courses",
      "training",
      "certification",
      "certificate",
      "learn",
      "class",
      "lms",
      "একাডেমি",
      "কোর্স",
      "প্রশিক্ষণ",
      "সার্টিফিকেট",
      "শিখ",
      "アカデミー",
      "コース",
      "研修",
      "トレーニング",
      "認定",
      "学ぶ",
    ],
    strong: [
      "medacademy",
      "med academy",
      "academy",
      "course",
      "কোর্স",
      "コース",
    ],
  },
  {
    id: "digihealth",
    kw: [
      "digihealth",
      "software",
      "app",
      "system",
      "license",
      "digital health",
      "platform",
      "saas",
      "ডিজিহেলথ",
      "সফটওয়্যার",
      "সফটওয়্যার",
      "লাইসেন্স",
      "ডিজিটাল হেলথ",
      "ソフトウェア",
      "アプリ",
      "システム",
      "ライセンス",
      "デジタルヘルス",
    ],
    strong: ["digihealth", "software", "সফটওয়্যার", "ソフトウェア"],
  },
  {
    id: "tourism",
    kw: [
      "tourism",
      "medical tourism",
      "treatment abroad",
      "travel",
      "overseas treatment",
      "hospital abroad",
      "doctor abroad",
      "consultation",
      "teleconsult",
      "visa",
      "ট্যুরিজম",
      "মেডিকেল ট্যুরিজম",
      "বিদেশে চিকিৎসা",
      "চিকিৎসা",
      "ভ্রমণ",
      "ভিসা",
      "ツーリズム",
      "医療ツーリズム",
      "海外",
      "治療",
      "渡航",
    ],
    strong: [
      "medical tourism",
      "treatment abroad",
      "মেডিকেল ট্যুরিজম",
      "医療ツーリズム",
    ],
  },
  {
    id: "healthCorner",
    kw: [
      "health corner",
      "wellness",
      "হেলথ কর্নার",
      "ওয়েলনেস",
      "ヘルスコーナー",
      "ウェルネス",
    ],
  },
  {
    id: "blog",
    kw: [
      "blog",
      "article",
      "articles",
      "news",
      "read",
      "ব্লগ",
      "আর্টিকেল",
      "খবর",
      "ブログ",
      "記事",
      "ニュース",
    ],
  },
  {
    id: "about",
    kw: [
      "about",
      "who are you",
      "who are we",
      "company",
      "history",
      "about the company",
      "আপনারা কারা",
      "কোম্পানি",
      "সম্পর্কে",
      "会社",
      "について",
      "企業",
      "誰",
    ],
  },
  {
    id: "contact",
    kw: [
      "contact",
      "phone",
      "call",
      "email",
      "address",
      "office",
      "location",
      "reach you",
      "where are you",
      "যোগাযোগ",
      "ফোন",
      "কল",
      "ইমেইল",
      "ঠিকানা",
      "অফিস",
      "連絡",
      "電話",
      "メール",
      "住所",
      "オフィス",
      "所在地",
    ],
    strong: ["contact", "phone", "যোগাযোগ", "連絡先", "連絡"],
  },
  {
    id: "hours",
    kw: [
      "hours",
      "open",
      "opening",
      "when are you open",
      "working hours",
      "business hours",
      "সময়",
      "খোলা",
      "কর্মঘণ্টা",
      "営業時間",
      "何時",
      "開いて",
    ],
  },
  {
    id: "shipping",
    kw: [
      "shipping",
      "delivery",
      "deliver",
      "ship",
      "courier",
      "how long delivery",
      "শিপিং",
      "ডেলিভারি",
      "পাঠাবেন",
      "配送",
      "送料",
      "配達",
      "届く",
    ],
    strong: ["shipping", "delivery", "ডেলিভারি", "配送"],
  },
  {
    id: "returns",
    kw: [
      "return",
      "returns",
      "refund",
      "exchange",
      "warranty",
      "রিটার্ন",
      "ফেরত",
      "রিফান্ড",
      "বিনিময়",
      "ওয়ারেন্টি",
      "返品",
      "返金",
      "交換",
      "保証",
    ],
    strong: ["refund", "return", "রিটার্ন", "返品"],
  },
  {
    id: "payment",
    kw: [
      "payment",
      "pay",
      "how to pay",
      "bank transfer",
      "cash on delivery",
      "cod",
      "bkash",
      "card",
      "gateway",
      "পেমেন্ট",
      "পরিশোধ",
      "বিকাশ",
      "ব্যাংক",
      "支払い",
      "決済",
      "銀行",
      "代引き",
    ],
    strong: ["payment", "পেমেন্ট", "支払い", "決済"],
  },
  {
    id: "how_to_order",
    kw: [
      "how to order",
      "how do i order",
      "place an order",
      "ordering",
      "checkout",
      "how to buy",
      "how do i buy",
      "how can i buy",
      "where can i buy",
      "how do i purchase",
      "how to purchase",
      "কীভাবে অর্ডার",
      "কিভাবে অর্ডার",
      "অর্ডার করব",
      "চেকআউট",
      "注文方法",
      "どうやって注文",
      "購入方法",
    ],
  },
  {
    id: "quotation",
    kw: [
      "quote",
      "quotation",
      "rfq",
      "request a quote",
      "pricing",
      "get a price",
      "কোটেশন",
      "দর",
      "দাম",
      "মূল্য জানতে",
      "見積",
      "見積もり",
      "価格",
      "いくら",
    ],
    strong: ["quotation", "quote", "rfq", "কোটেশন", "見積もり"],
  },
  {
    id: "request_product",
    kw: [
      "request a product",
      "source a product",
      "cant find",
      "can't find",
      "do you have",
      "special order",
      "পণ্যের অনুরোধ",
      "খুঁজে পাচ্ছি না",
      "商品リクエスト",
      "取り寄せ",
      "見つからない",
    ],
  },
  {
    id: "become_seller",
    kw: [
      "become a seller",
      "sell on",
      "seller",
      "vendor",
      "list my product",
      "sell my",
      "বিক্রেতা হ",
      "বিক্রি করতে চাই",
      "出品",
      "販売したい",
      "セラー",
      "ベンダー",
    ],
    strong: ["become a seller", "seller", "বিক্রেতা", "出品"],
  },
  {
    id: "login",
    kw: [
      "login",
      "log in",
      "sign in",
      "sign up",
      "register",
      "create account",
      "my account",
      "account",
      "password",
      "লগইন",
      "লগ ইন",
      "সাইন",
      "রেজিস্টার",
      "অ্যাকাউন্ট",
      "ログイン",
      "サインイン",
      "登録",
      "アカウント",
    ],
    strong: ["login", "log in", "sign in", "লগইন", "ログイン"],
  },
  {
    id: "order_lookup",
    kw: [
      "track",
      "track order",
      "order status",
      "my order",
      "where is my order",
      "order number",
      "shipment",
      "অর্ডার ট্র্যাক",
      "অর্ডার স্ট্যাটাস",
      "আমার অর্ডার",
      "注文追跡",
      "注文状況",
      "配送状況",
      "注文番号",
    ],
    strong: ["track order", "order status", "অর্ডার ট্র্যাক", "注文状況"],
  },
  {
    id: "case_lookup",
    kw: [
      "case status",
      "my case",
      "case reference",
      "treatment status",
      "কেস স্ট্যাটাস",
      "আমার কেস",
      "ケース状況",
      "ケース番号",
      "治療状況",
    ],
    strong: ["case status", "কেস স্ট্যাটাস", "ケース状況"],
  },
  {
    id: "product_search",
    kw: [
      "search",
      "find",
      "look for",
      "looking for",
      "do you have",
      "do you sell",
      "show me",
      "browse products",
      "how much is",
      "how much are",
      "how much does",
      "price of",
      "cost of",
      "খুঁজ",
      "খুঁজছি",
      "আছে কি",
      "検索",
      "探す",
      "探し",
      "ありますか",
      "見せて",
    ],
    strong: ["search", "look for", "খুঁজ", "検索"],
  },
  {
    id: "human",
    kw: [
      "human",
      "agent",
      "representative",
      "talk to someone",
      "talk to a person",
      "real person",
      "customer service",
      "support team",
      "call me",
      "whatsapp",
      "মানুষ",
      "প্রতিনিধি",
      "কারো সাথে কথা",
      "সাপোর্ট",
      "হোয়াটসঅ্যাপ",
      "担当者",
      "オペレーター",
      "人と話",
      "サポート",
      "ワッツアップ",
    ],
    strong: ["human", "agent", "talk to someone", "whatsapp", "担当者"],
  },
];

/** Priority order used only to break exact score ties (earlier = wins). */
const PRIORITY = INTENTS.map((i) => i.id);

export type IntentMatch = { intent: string; score: number };

/**
 * Score every intent against the normalized message and return the best.
 * Returns `null` (→ fallback) when nothing scores.
 */
export function matchIntent(normalized: string): IntentMatch | null {
  let best: IntentMatch | null = null;
  for (const def of INTENTS) {
    let score = 0;
    for (const kw of def.kw) if (containsKeyword(normalized, kw)) score += 1;
    for (const kw of def.strong ?? [])
      if (containsKeyword(normalized, kw)) score += 2;
    if (score === 0) continue;
    if (
      !best ||
      score > best.score ||
      (score === best.score &&
        PRIORITY.indexOf(def.id) < PRIORITY.indexOf(best.intent))
    ) {
      best = { intent: def.id, score };
    }
  }
  return best;
}

/**
 * Exact match of a clicked quick-reply chip in any locale → its intent. Ensures
 * a tapped suggestion always maps correctly regardless of keyword scoring.
 */
export function chipIntent(normalized: string): string | null {
  for (const chip of Object.values(CHIPS)) {
    for (const loc of ["en", "bn", "ja"] as Locale[]) {
      if (normalize(pick(chip.label, loc)) === normalized) return chip.intent;
    }
  }
  return null;
}

/**
 * Words that carry no product meaning in a spoken question. The catalogue
 * matcher requires every term to appear in a product, so "do you sell
 * oximeters" only finds anything once the wrapper is stripped off.
 */
const SEARCH_STOP_WORDS = new Set(
  (
    "a an the any some please hi hello " +
    "i we you my me us your " +
    "do does did can could would will is are am have has there " +
    "want wanted need needed looking look " +
    "for to of in on at with about and or " +
    "how what where which who when much " +
    "buy purchase order sell sells selling get find search searching browse " +
    "got show give tell help price prices cost costs"
  ).split(" "),
);

/**
 * Reduce a message to the part worth searching the catalogue for: "how do i
 * buy a blood pressure monitor" becomes "blood pressure monitor". Returns ""
 * when the message names nothing.
 */
export function searchPhrase(normalized: string): string {
  const words = normalized.split(" ").filter(Boolean);
  return words.filter((w) => !SEARCH_STOP_WORDS.has(w)).join(" ");
}

/**
 * The queries to try for one phrase, most specific first. A shopper's words
 * for a product often differ from the catalogue's ("blood pressure monitor"
 * vs "Omron Digital BP Monitor"), so if the full phrase finds nothing we fall
 * back to the head noun, which is the product type.
 */
export function searchAttempts(phrase: string): string[] {
  const out: string[] = [];
  const add = (q: string) => {
    if (q.length >= 3 && !out.includes(q)) out.push(q);
  };
  add(phrase);
  add(singularise(phrase));
  const words = phrase.split(" ").filter(Boolean);
  const head = singularise(words[words.length - 1] ?? "");
  if (words.length > 1 && head.length >= 4) add(head);
  return out;
}

/**
 * A naive singular form, used only as a second attempt when the plural found
 * nothing: catalogue names are singular ("Oximeter"), and the matcher works on
 * substrings, so "oximeters" would otherwise miss.
 */
export function singularise(phrase: string): string {
  return phrase.split(" ").map(singulariseWord).join(" ");
}

function singulariseWord(word: string): string {
  if (word.length <= 3 || !word.endsWith("s") || word.endsWith("ss")) {
    return word;
  }
  // Only a sibilant takes "-es": "boxes" is a box, but "gloves" is a glove.
  return /(?:s|x|z|ch|sh)es$/.test(word)
    ? word.slice(0, -2)
    : word.slice(0, -1);
}

/** Does a phrase read like a product noun-phrase worth auto-searching? */
export function looksLikeSearch(phrase: string): boolean {
  const words = phrase.split(" ").filter(Boolean);
  return (
    phrase.length >= 3 &&
    phrase.length <= 60 &&
    words.length >= 1 &&
    words.length <= 6 &&
    !phrase.includes("@")
  );
}
