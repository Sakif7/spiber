/**
 * Google AdSense on article pages — blog posts today, any article page that
 * renders through `PostBody` later. Never on shops, checkout or accounts.
 *
 * The publisher ID decides who Google pays, so it lives in a super-admin
 * setting (`adsense`, `lib/services/ads-settings.service.ts`) and is checked
 * against these patterns before it reaches a page: the ad markup is written
 * straight into the article's HTML, so nothing but the IDs' digits may come
 * from the setting. No DB import — the admin form shares this file.
 */

export type AdsenseSettings = {
  /** Ads show only when this is on AND both IDs are set. */
  enabled: boolean;
  /** `pub-…`, or "" before the account exists. Serves /ads.txt on its own. */
  publisherId: string;
  /** The in-article ad unit's ID (`data-ad-slot`), or "". */
  inArticleSlot: string;
};

export const ADSENSE_DEFAULTS: AdsenseSettings = {
  enabled: false,
  publisherId: "",
  inArticleSlot: "",
};

/** AdSense shows the account as `pub-…`; its ad code says `ca-pub-…`. */
const PUBLISHER_ID = /^(?:ca-)?(pub-\d{10,20})$/;
const AD_SLOT_ID = /^\d{6,20}$/;

/** `pub-…` whichever form was pasted, or null when it is not one. */
export function normalizePublisherId(raw: string): string | null {
  const m = PUBLISHER_ID.exec(raw.trim());
  return m ? m[1] : null;
}

export function isAdSlotId(raw: string): boolean {
  return AD_SLOT_ID.test(raw.trim());
}

/** The ads.txt record that authorises Google to sell this site's ad space. */
export function adsTxt(publisherId: string): string {
  return `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`;
}

/** What an article page needs to show ads, or null while they are off. */
export function articleAds(
  s: AdsenseSettings,
): { client: string; slot: string } | null {
  const pub = normalizePublisherId(s.publisherId);
  if (!s.enabled || !pub || !isAdSlotId(s.inArticleSlot)) return null;
  return { client: `ca-${pub}`, slot: s.inArticleSlot.trim() };
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * One in-article slot: Google's own `<ins>` under a label the policy allows
 * ("Advertisements" or "Sponsored links" only, translated).
 */
export function inArticleAdMarkup({
  client,
  slot,
  label,
}: {
  client: string;
  slot: string;
  label: string;
}): string {
  return (
    `<div class="ad-slot"><div class="ad-slot-label">${escapeHtml(label)}</div>` +
    `<ins class="adsbygoogle" style="display:block;text-align:center"` +
    ` data-ad-layout="in-article" data-ad-format="fluid"` +
    ` data-ad-client="${escapeHtml(client)}" data-ad-slot="${escapeHtml(slot)}"></ins></div>`
  );
}

/** The paragraphs an in-article ad follows: two ads, three paragraphs apart. */
export const IN_ARTICLE_AFTER = [3, 6] as const;

// Void elements never open a level; sanitize-html writes them as `<br />`.
const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;

/**
 * Text or an image — something a reader sees. The editor leaves empty
 * paragraphs behind (always one at the end of a post), and those are not.
 */
function hasContent(fragment: string): boolean {
  return (
    /<img\b/i.test(fragment) ||
    fragment
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;|&#160;| /g, " ")
      .trim() !== ""
  );
}

/**
 * Where each top-level paragraph of `html` that has content ends, as string
 * offsets.
 *
 * Only for `sanitizeRichHtml` output: well-formed, no comments or raw-text
 * elements, and `<` / `>` escaped in text and attribute values — which is
 * what lets a tag scan stand in for a parser.
 */
function paragraphEnds(html: string): number[] {
  const ends: number[] = [];
  let depth = 0;
  let start = 0;
  for (const m of html.matchAll(TAG)) {
    const [whole, closing, name] = m;
    const tag = name.toLowerCase();
    if (closing) {
      depth = Math.max(0, depth - 1);
      const end = m.index + whole.length;
      if (depth === 0 && tag === "p" && hasContent(html.slice(start, end)))
        ends.push(end);
    } else if (!VOID.has(tag) && !whole.endsWith("/>")) {
      if (depth === 0) start = m.index;
      depth += 1;
    }
  }
  return ends;
}

/**
 * `html` with `markup` after the given top-level paragraphs. Paragraphs inside
 * lists and quotes do not count, nor do empty ones, and an ad needs content
 * after it, so it always sits between paragraphs and never closes the article.
 */
export function withInArticleAds(
  html: string,
  markup: string,
  after: readonly number[] = IN_ARTICLE_AFTER,
): string {
  const ends = paragraphEnds(html);
  const at = after
    .map((n) => ends[n - 1])
    .filter((i): i is number => i !== undefined && hasContent(html.slice(i)))
    .sort((a, b) => b - a);
  let out = html;
  for (const i of at) out = out.slice(0, i) + markup + out.slice(i);
  return out;
}
