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
import { EditorHeader } from "@/components/admin/ui/form-shell";

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
    title: {
      en: post.title.en,
      bn: post.title.bn ?? "",
      ja: post.title.ja ?? "",
    },
    slug: post.slug,
    excerpt: post.excerpt
      ? {
          en: post.excerpt.en ?? "",
          bn: post.excerpt.bn ?? "",
          ja: post.excerpt.ja ?? "",
        }
      : { en: "", bn: "", ja: "" },
    bodyEn: post.body.en ?? "",
    bodyBn: post.body.bn ?? "",
    bodyJa: post.body.ja ?? "",
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
        ja: post.seo?.metaTitle?.ja ?? "",
      },
      metaDescription: {
        en: post.seo?.metaDescription?.en ?? "",
        bn: post.seo?.metaDescription?.bn ?? "",
        ja: post.seo?.metaDescription?.ja ?? "",
      },
      ogImage: post.seo?.ogImage,
    },
  };

  return (
    <div className="space-y-4">
      <EditorHeader
        backHref="/admin/blog/posts"
        backLabel="Posts"
        title="Edit post"
      />
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
