"use client";

import { PostEditor, type PostEditorInitial } from "./post-editor";
import { useRecord, RecordPending } from "@/components/admin/ui/use-record";

type Opt = { id: string; name: string };

/**
 * The post editor in a panel. Identical to the create case except that the
 * record is fetched when the panel opens — a post's body is too big to send
 * with every row of the list.
 */
export function PostEditorPanel({
  id,
  categories,
  tags,
}: {
  id: string;
  categories: Opt[];
  tags: Opt[];
}) {
  const { data, error } = useRecord<PostEditorInitial>(
    `/api/admin/blog/posts/${id}`,
  );
  if (!data) return <RecordPending error={error} />;
  return <PostEditor initial={data} categories={categories} tags={tags} />;
}
