import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  PostEditor,
  type PostEditorInitial,
} from "@/components/admin/blog/post-editor";
import { getPostByIdLean } from "@/lib/repositories/blog.repo";
import {
  listBlogCategories,
  listBlogTags,
} from "@/lib/repositories/blogTaxonomy.repo";
import { localize } from "@/lib/schemas/localized";

export const dynamic = "force-dynamic";

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const [post, cats, tags] = await Promise.all([
    getPostByIdLean(id).catch(() => null),
    listBlogCategories().catch(() => []),
    listBlogTags().catch(() => []),
  ]);
  if (!post) notFound();

  const initial: PostEditorInitial = {
    id: String(post._id),
    title: { en: post.title.en, bn: post.title.bn ?? "" },
    slug: post.slug,
    excerpt: post.excerpt
      ? { en: post.excerpt.en ?? "", bn: post.excerpt.bn ?? "" }
      : { en: "", bn: "" },
    bodyEn: post.body.en ?? "",
    bodyBn: post.body.bn ?? "",
    coverImage: post.coverImage,
    authorName: post.authorName ?? "",
    categoryId: post.categoryId ? String(post.categoryId) : "",
    tagIds: (post.tagIds ?? []).map((t) => String(t)),
    status: post.status,
    scheduledFor: post.scheduledFor
      ? new Date(post.scheduledFor).toISOString().slice(0, 16)
      : "",
    seo: {
      metaTitle: {
        en: post.seo?.metaTitle?.en ?? "",
        bn: post.seo?.metaTitle?.bn ?? "",
      },
      metaDescription: {
        en: post.seo?.metaDescription?.en ?? "",
        bn: post.seo?.metaDescription?.bn ?? "",
      },
      ogImage: post.seo?.ogImage,
    },
  };

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <h1
        style={{
          margin: 0,
          fontFamily: "var(--font-display)",
          fontSize: "var(--fs-2xl)",
          color: "var(--color-text-strong)",
        }}
      >
        Edit post
      </h1>
      <PostEditor
        initial={initial}
        categories={cats.map((c) => ({
          id: String(c._id),
          name: localize(c.name, "en"),
        }))}
        tags={tags.map((t) => ({
          id: String(t._id),
          name: localize(t.name, "en"),
        }))}
      />
    </div>
  );
}
