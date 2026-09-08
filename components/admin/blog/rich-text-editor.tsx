"use client";

import { useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link2,
  ImagePlus,
  Undo,
  Redo,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false, // required under Next SSR
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: { attributes: { class: "rte-content" } },
  });

  return (
    <div className="border-border bg-card overflow-hidden rounded-md border">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      {/* The editor body is contenteditable DOM owned by TipTap, so its
          typography is styled with a scoped sheet rather than utilities. */}
      <style>{`
        .rte-content { min-height: 200px; padding: 12px 14px; outline: none; font-size: var(--fs-body); line-height: 1.7; }
        .rte-content:focus { outline: none; }
        .rte-content p { margin: 0 0 0.75em; }
        .rte-content h2 { font-size: 1.4em; margin: 1em 0 0.4em; color: var(--color-text-strong); }
        .rte-content h3 { font-size: 1.2em; margin: 1em 0 0.4em; color: var(--color-text-strong); }
        .rte-content ul, .rte-content ol { padding-left: 1.4em; margin: 0 0 0.75em; }
        .rte-content blockquote { border-left: 3px solid var(--color-border); margin: 0 0 0.75em; padding-left: 1em; color: var(--color-text-muted); }
        .rte-content pre { background: var(--color-surface-2); padding: 10px 12px; border-radius: 6px; overflow:auto; }
        .rte-content img { max-width: 100%; border-radius: 8px; }
        .rte-content a { color: var(--color-brand-deep); text-decoration: underline; }
        .rte-content p.is-editor-empty:first-child::before { content:"Write the post…"; color: var(--color-text-subtle); float: left; height: 0; pointer-events: none; }
      `}</style>
    </div>
  );
}

/** One toolbar control. `on` (when given) marks a toggleable mark as active. */
function B({
  on,
  onClick,
  label,
  children,
}: {
  on?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      aria-pressed={on}
      title={label}
      onClick={onClick}
      className={cn(
        "text-muted-foreground hover:text-foreground",
        on && "bg-card text-foreground border",
      )}
    >
      {children}
    </Button>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  const [uploading, setUploading] = useState(false);
  if (!editor) {
    return <div className="bg-muted border-border h-11 border-b" />;
  }

  async function uploadImage(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/uploads", { method: "POST", body: fd });
    const json = await res.json().catch(() => null);
    setUploading(false);
    if (res.ok && json?.ok) {
      editor!.chain().focus().setImage({ src: json.data.url }).run();
    }
  }

  function toggleLink() {
    const prev = editor!.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor!.chain().focus().unsetLink().run();
      return;
    }
    editor!.chain().focus().setLink({ href: url }).run();
  }

  return (
    <div className="bg-muted border-border flex flex-wrap items-center gap-0.5 border-b p-1.5">
      <B
        label="Bold"
        on={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-4" />
      </B>
      <B
        label="Italic"
        on={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-4" />
      </B>
      <B
        label="Strikethrough"
        on={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="size-4" />
      </B>
      <B
        label="Heading 2"
        on={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="size-4" />
      </B>
      <B
        label="Heading 3"
        on={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="size-4" />
      </B>
      <B
        label="Bullet list"
        on={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-4" />
      </B>
      <B
        label="Ordered list"
        on={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-4" />
      </B>
      <B
        label="Quote"
        on={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="size-4" />
      </B>
      <B
        label="Code block"
        on={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code className="size-4" />
      </B>
      <B label="Link" on={editor.isActive("link")} onClick={toggleLink}>
        <Link2 className="size-4" />
      </B>
      <label
        title="Insert image"
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "text-muted-foreground hover:text-foreground",
          uploading ? "cursor-default opacity-60" : "cursor-pointer",
        )}
      >
        <ImagePlus className="size-4" />
        <input
          type="file"
          accept="image/*"
          hidden
          disabled={uploading}
          aria-label="Insert image"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadImage(f);
            e.target.value = "";
          }}
        />
      </label>
      <B label="Undo" onClick={() => editor.chain().focus().undo().run()}>
        <Undo className="size-4" />
      </B>
      <B label="Redo" onClick={() => editor.chain().focus().redo().run()}>
        <Redo className="size-4" />
      </B>
    </div>
  );
}
