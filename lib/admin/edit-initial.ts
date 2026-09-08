/**
 * What an edit panel prefills from.
 *
 * These four editors carry documents too large to ride along on every row of a
 * list — a post's body, a course's whole curriculum, a product's variants — so
 * their panel asks for one record when it opens. The shape returned here is
 * exactly the form's `initial`, built field by field rather than by spreading
 * the document, so nothing the form has no business seeing can leak out.
 */
import type { PostEditorInitial } from "@/components/admin/blog/post-editor";
import type { CourseBuilderInitial } from "@/components/admin/academy/course-builder";
import type { ProductFormInitial } from "@/components/admin/product-form";
import type { MarketplaceProductInitial } from "@/components/admin/marketplace-product-form";

type Loc = { en?: string; bn?: string; ja?: string } | null | undefined;

const L = (v: Loc) => ({ en: v?.en ?? "", bn: v?.bn ?? "", ja: v?.ja ?? "" });

/* eslint-disable @typescript-eslint/no-explicit-any -- these take lean Mongoose
   documents whose generated types vary per model; every field read here is
   named explicitly below, so the shape is checked by the return type. */

export function postEditInitial(post: any): PostEditorInitial {
  return {
    id: String(post._id),
    title: L(post.title),
    slug: post.slug,
    excerpt: L(post.excerpt),
    bodyEn: post.body?.en ?? "",
    bodyBn: post.body?.bn ?? "",
    bodyJa: post.body?.ja ?? "",
    coverImage: post.coverImage,
    authorName: post.authorName ?? "",
    categoryId: post.categoryId ? String(post.categoryId) : "",
    tagIds: (post.tagIds ?? []).map((t: unknown) => String(t)),
    status: post.status,
    scheduledFor: post.scheduledFor
      ? new Date(post.scheduledFor).toISOString().slice(0, 16)
      : "",
    seo: {
      metaTitle: L(post.seo?.metaTitle),
      metaDescription: L(post.seo?.metaDescription),
      ogImage: post.seo?.ogImage,
    },
  };
}

export function courseEditInitial(c: any): CourseBuilderInitial {
  return {
    id: String(c._id),
    title: L(c.title),
    slug: c.slug,
    summary: L(c.summary),
    description: L(c.description),
    thumbnail: c.thumbnail ?? "",
    level: c.level,
    priceMinor: c.priceMinor,
    status: c.status,
    modules: (c.modules ?? []).map((m: any) => ({
      id: m.id,
      title: L(m.title),
      lessons: (m.lessons ?? []).map((l: any) => ({
        id: l.id,
        title: L(l.title),
        type: l.type,
        videoUid: l.videoUid ?? "",
        videoStatus: l.videoStatus ?? "",
        durationSec: l.durationSec,
        body: L(l.body),
        resources: (l.resources ?? []).map((r: any) => ({
          name: r.name,
          fileKey: r.fileKey,
        })),
        isFreePreview: Boolean(l.isFreePreview),
        quiz: {
          passPercent: l.quiz?.passPercent ?? 70,
          questions: (l.quiz?.questions ?? []).map((q: any) => ({
            id: q.id,
            prompt: L(q.prompt),
            options: (q.options ?? []).map((o: any) => ({
              id: o.id,
              text: L(o.text),
            })),
            correctOptionId: q.correctOptionId,
            explanation: L(q.explanation),
          })),
        },
      })),
    })),
  };
}

const specRows = (specs: any[] | undefined) =>
  (specs ?? []).map((s: any) => ({ key: L(s.key), value: L(s.value) }));

export function productEditInitial(p: any): ProductFormInitial {
  return {
    id: String(p._id),
    sku: p.sku,
    slug: p.slug,
    // Every localized field carries `ja` through. The pages this replaced
    // mapped only en/bn, so saving an edit quietly dropped the Japanese.
    name: L(p.name),
    description: L(p.description),
    categoryId: String(p.categoryId),
    brandId: p.brandId ? String(p.brandId) : undefined,
    priceMinor: p.priceMinor ?? undefined,
    floorPriceMinor: p.floorPriceMinor ?? null,
    lowStockThreshold: p.lowStockThreshold,
    stockQty: p.stockQty ?? 0,
    trackStock: p.trackStock ?? null,
    status: p.status,
    specs: specRows(p.specs),
    images: p.images ?? [],
  };
}

export function marketplaceProductEditInitial(
  p: any,
): MarketplaceProductInitial {
  return {
    id: String(p._id),
    sku: p.sku,
    slug: p.slug,
    name: L(p.name),
    description: L(p.description),
    categoryId: String(p.categoryId),
    brandId: p.brandId ? String(p.brandId) : undefined,
    priceMinor: p.priceMinor,
    compareAtMinor: p.compareAtMinor ?? null,
    lowStockThreshold: p.lowStockThreshold,
    stockQty: p.stockQty ?? 0,
    status: p.status,
    featured: p.featured,
    specs: specRows(p.specs),
    images: p.images ?? [],
    variantOptions: (p.variantOptions ?? []).map((o: any) => ({
      name: L(o.name),
      values: (o.values ?? []).map((v: any) => L(v)),
    })),
    variants: (p.variants ?? []).map((v: any) => ({
      id: v.id,
      options: v.options,
      sku: v.sku,
      priceMinorOverride: v.priceMinorOverride ?? null,
      stockQty: v.stockQty,
    })),
  };
}
