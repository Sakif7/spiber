import { setRequestLocale } from "next-intl/server";
import { PostEditor } from "@/components/admin/blog/post-editor";
import {
  listBlogCategories,
  listBlogTags,
} from "@/lib/repositories/blogTaxonomy.repo";
import { localize } from "@/lib/schemas/localized";

export const dynamic = "force-dynamic";

export default async function NewBlogPostPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [cats, tags] = await Promise.all([
    listBlogCategories().catch(() => []),
    listBlogTags().catch(() => []),
  ]);
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
        New post
      </h1>
      <PostEditor
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
