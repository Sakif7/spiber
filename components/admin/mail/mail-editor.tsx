"use client";

import {
  useEditor,
  useEditorState,
  EditorContent,
  type Editor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * The mail body editor: the blog's TipTap setup trimmed to what belongs in
 * a message (marks, lists, quotes, links — no headings, images or code).
 * Hands back HTML for the wire and the plain text that goes with it; the
 * server sanitises the HTML again before anything is sent.
 */
export function MailEditor({
  initialHtml,
  onChange,
  placeholder = "Write your message…",
  minHeight = "12rem",
  autoFocus,
  onSubmit,
  disabled,
  className,
}: {
  initialHtml?: string;
  onChange: (html: string, text: string) => void;
  placeholder?: string;
  minHeight?: string;
  autoFocus?: boolean;
  /** Ctrl/⌘+Enter. */
  onSubmit?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false, // required under Next SSR
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        link: { openOnClick: false, autolink: true },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: initialHtml || "",
    autofocus: autoFocus ? "start" : false,
    editable: !disabled,
    onUpdate: ({ editor }) =>
      onChange(editor.getHTML(), editor.getText({ blockSeparator: "\n\n" })),
    editorProps: {
      attributes: { class: "mail-rte", style: `min-height:${minHeight}` },
      handleKeyDown: (_view, e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && onSubmit) {
          e.preventDefault();
          onSubmit();
          return true;
        }
        return false;
      },
    },
  });

  return (
    <div
      className={cn(
        "border-input bg-background focus-within:border-ring focus-within:ring-ring/50 overflow-hidden rounded-lg border transition-[color,box-shadow] focus-within:ring-[3px]",
        disabled && "opacity-60",
        className,
      )}
    >
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      {/* The editor body is contenteditable DOM owned by TipTap, so its
          typography is styled with a scoped sheet rather than utilities. */}
      <style>{`
        .mail-rte { padding: 10px 12px; outline: none; font-size: 0.875rem; line-height: 1.6; }
        .mail-rte p { margin: 0 0 0.5em; }
        .mail-rte p:last-child { margin-bottom: 0; }
        .mail-rte ul, .mail-rte ol { padding-left: 1.4em; margin: 0 0 0.5em; }
        .mail-rte ul { list-style: disc; }
        .mail-rte ol { list-style: decimal; }
        .mail-rte blockquote { border-left: 2px solid var(--color-border); margin: 0 0 0.5em; padding-left: 0.75em; color: var(--color-text-muted); }
        .mail-rte a { color: var(--color-brand-deep); text-decoration: underline; }
        .mail-rte p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: var(--color-text-subtle); float: left; height: 0; pointer-events: none; }
      `}</style>
    </div>
  );
}

function B({
  on,
  onClick,
  label,
  disabled,
  children,
}: {
  on?: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      aria-pressed={on}
      title={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep the selection
      onClick={onClick}
      className={cn(
        "text-muted-foreground hover:text-foreground",
        on && "bg-accent text-foreground",
      )}
    >
      {children}
    </Button>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  // TipTap 3 does not re-render on every transaction; read the active marks
  // through a selector so the buttons follow the caret.
  const on = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            strike: e.isActive("strike"),
            bulletList: e.isActive("bulletList"),
            orderedList: e.isActive("orderedList"),
            blockquote: e.isActive("blockquote"),
            link: e.isActive("link"),
            undo: e.can().undo(),
            redo: e.can().redo(),
          }
        : null,
  });
  if (!editor || !on) return <div className="border-border h-8 border-b" />;

  function toggleLink() {
    const prev = editor!.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link address", prev ?? "https://");
    if (url === null) return;
    if (url.trim() === "" || url.trim() === "https://") {
      editor!.chain().focus().unsetLink().run();
      return;
    }
    editor!
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url.trim() })
      .run();
  }

  return (
    <div className="border-border flex flex-wrap items-center gap-0.5 border-b px-1 py-0.5">
      <B
        label="Bold"
        on={on.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-3.5" />
      </B>
      <B
        label="Italic"
        on={on.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-3.5" />
      </B>
      <B
        label="Underline"
        on={on.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline className="size-3.5" />
      </B>
      <B
        label="Strikethrough"
        on={on.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="size-3.5" />
      </B>
      <span className="bg-border mx-1 h-4 w-px" aria-hidden />
      <B
        label="Bulleted list"
        on={on.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-3.5" />
      </B>
      <B
        label="Numbered list"
        on={on.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-3.5" />
      </B>
      <B
        label="Quote"
        on={on.blockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="size-3.5" />
      </B>
      <B label="Link" on={on.link} onClick={toggleLink}>
        <Link2 className="size-3.5" />
      </B>
      <B
        label="Clear formatting"
        onClick={() =>
          editor.chain().focus().unsetAllMarks().clearNodes().run()
        }
      >
        <RemoveFormatting className="size-3.5" />
      </B>
      <span className="flex-1" />
      <B
        label="Undo"
        disabled={!on.undo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo className="size-3.5" />
      </B>
      <B
        label="Redo"
        disabled={!on.redo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo className="size-3.5" />
      </B>
    </div>
  );
}
