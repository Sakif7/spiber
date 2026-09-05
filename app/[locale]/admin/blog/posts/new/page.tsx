import { setRequestLocale } from "next-intl/server";
import { PostEditor } from "@/components/admin/blog/post-editor";
import {
  listBlogCategories,
  listBlogTags,
} from "@/lib/repositories/blogTaxonomy.repo";
import { localize } from "@/lib/schemas/localized";
import { EditorHeader } from "@/components/admin/ui/form-shell";

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
    <div className="space-y-4">
      <EditorHeader
        backHref="/admin/blog/posts"
        backLabel="Posts"
        title="New post"
      />
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
