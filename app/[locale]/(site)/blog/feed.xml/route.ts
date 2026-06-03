import { listVisiblePostsForFeed } from "@/lib/repositories/blog.repo";
import { localize } from "@/lib/schemas/localized";
import { excerptFromHtml } from "@/lib/reading-time";
import { siteConfig } from "@/lib/site-config";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

function esc(s: string | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Per-locale RSS 2.0 feed of published posts. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const l = locale as Locale;
  const base = siteConfig.url.replace(/\/$/, "");
  const channelLink = `${base}/${l}/blog`;

  const posts = await listVisiblePostsForFeed(30).catch(() => []);
  const items = posts
    .map((p) => {
      const link = `${base}/${l}/blog/${p.slug}`;
      const desc = p.excerpt
        ? localize(p.excerpt, l)
        : excerptFromHtml(localize(p.body, l));
      const pub = p.publishedAt ? new Date(p.publishedAt).toUTCString() : "";
      return `<item><title>${esc(localize(p.title, l))}</title><link>${link}</link><guid isPermaLink="true">${link}</guid>${
        pub ? `<pubDate>${pub}</pubDate>` : ""
      }<description>${esc(desc)}</description></item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(
    siteConfig.brand,
  )} — Blog</title><link>${channelLink}</link><description>${esc(
    "Insights & updates from the Spiber Med team.",
  )}</description><language>${l}</language>${items}</channel></rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=600",
    },
  });
}
