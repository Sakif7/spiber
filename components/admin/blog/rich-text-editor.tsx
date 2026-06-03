"use client";

import { useState, type CSSProperties } from "react";
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
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--r-sm)",
        background: "var(--color-surface)",
        overflow: "hidden",
      }}
    >
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
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
        .rte-content p.is-editor-empty:first-child::before { content: "Write the post…"; color: var(--color-text-subtle); float: left; height: 0; pointer-events: none; }
      `}</style>
    </div>
  );
}

const btn: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 32,
  height: 32,
  borderRadius: "var(--r-sm)",
  border: "1px solid transparent",
  background: "transparent",
  color: "var(--color-text-muted)",
  cursor: "pointer",
};
const btnActive: CSSProperties = {
  ...btn,
  background: "var(--color-secondary-soft)",
  color: "var(--color-secondary-deep)",
};

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
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={on ? btnActive : btn}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  const [uploading, setUploading] = useState(false);
  if (!editor) {
    return (
      <div
        style={{
          height: 44,
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-surface-2)",
        }}
      />
    );
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
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 2,
        padding: 6,
        borderBottom: "1px solid var(--color-border)",
        background: "var(--color-surface-2)",
      }}
    >
      <B
        label="Bold"
        on={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={16} />
      </B>
      <B
        label="Italic"
        on={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={16} />
      </B>
      <B
        label="Strikethrough"
        on={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={16} />
      </B>
      <B
        label="Heading 2"
        on={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={16} />
      </B>
      <B
        label="Heading 3"
        on={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 size={16} />
      </B>
      <B
        label="Bullet list"
        on={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={16} />
      </B>
      <B
        label="Ordered list"
        on={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={16} />
      </B>
      <B
        label="Quote"
        on={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={16} />
      </B>
      <B
        label="Code block"
        on={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code size={16} />
      </B>
      <B label="Link" on={editor.isActive("link")} onClick={toggleLink}>
        <Link2 size={16} />
      </B>
      <label
        style={{ ...btn, cursor: uploading ? "default" : "pointer" }}
        title="Insert image"
      >
        <ImagePlus size={16} />
        <input
          type="file"
          accept="image/*"
          hidden
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadImage(f);
            e.target.value = "";
          }}
        />
      </label>
      <B label="Undo" onClick={() => editor.chain().focus().undo().run()}>
        <Undo size={16} />
      </B>
      <B label="Redo" onClick={() => editor.chain().focus().redo().run()}>
        <Redo size={16} />
      </B>
    </div>
  );
}
