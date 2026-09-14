"use client";

import { useRef } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { toast } from "sonner";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  ChevronDown,
  Highlighter,
  Image as ImageIcon,
  Indent,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Outdent,
  Quote,
  Redo2,
  RemoveFormatting,
  Scissors,
  Strikethrough,
  Subscript,
  Superscript,
  Table as TableIcon,
  Underline,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SelectField } from "@/components/admin/ui/select-field";
import { cn } from "@/lib/cn";
import { DOCUMENT_FONTS, FONT_SIZES, fontById } from "@/lib/documents/types";
import { fileToDocumentImage } from "./editor-images";

/**
 * The ribbon. One row of the controls a person expects from Word, grouped
 * the way Word groups them; a second row appears while the caret is in a
 * table. Every control reads its state from the editor selection, so the
 * bold button lights up on bold text and the font menu names the font under
 * the caret (or the document's default).
 */
const TEXT_COLOURS = [
  "#1a1a1a",
  "#444444",
  "#6d7c82",
  "#b91c1c",
  "#c2410c",
  "#a16207",
  "#15803d",
  "#0c6b6d",
  "#1d4ed8",
  "#6d28d9",
  "#be185d",
  "#78350f",
];
const HIGHLIGHTS = [
  "#fff1a8",
  "#c8f7c5",
  "#c5ecf7",
  "#fbd0e8",
  "#ffd8a8",
  "#e3e9eb",
];

const LINE_HEIGHTS = [
  { value: "1", label: "1.0" },
  { value: "1.15", label: "1.15" },
  { value: "1.5", label: "1.5" },
  { value: "2", label: "2.0" },
];

function Tool({
  label,
  on,
  disabled,
  onClick,
  children,
}: {
  label: string;
  on?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={on}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()} // keep the editor selection
          onClick={onClick}
          className={cn(
            "text-muted-foreground hover:text-foreground size-7",
            on && "bg-accent text-foreground",
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="flex items-center gap-0.5">{children}</div>
      <Separator orientation="vertical" className="mx-1 h-5! last:hidden" />
    </>
  );
}

function Swatches({
  label,
  colours,
  current,
  onPick,
  onClear,
  icon,
}: {
  label: string;
  colours: string[];
  current: string | null;
  onPick: (c: string) => void;
  onClear: () => void;
  icon: React.ReactNode;
}) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={label}
              onMouseDown={(e) => e.preventDefault()}
              className="text-muted-foreground hover:text-foreground relative size-7"
            >
              {icon}
              <span
                aria-hidden
                className="absolute right-1 bottom-0.5 left-1 h-[3px] rounded-sm"
                style={{ background: current ?? "transparent" }}
              />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="grid grid-cols-6 gap-1">
          {colours.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(c)}
              className={cn(
                "size-6 rounded border",
                current === c ? "ring-ring ring-2" : "border-border",
              )}
              style={{ background: c }}
            />
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="mt-2 w-full"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClear}
        >
          None
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export function EditorToolbar({
  editor,
  defaultFontId,
  defaultSize,
  onSaveVersion,
}: {
  editor: Editor;
  defaultFontId: string;
  defaultSize: number;
  onSaveVersion?: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      sub: e.isActive("subscript"),
      sup: e.isActive("superscript"),
      link: e.isActive("link"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      left: e.isActive({ textAlign: "left" }),
      center: e.isActive({ textAlign: "center" }),
      right: e.isActive({ textAlign: "right" }),
      justify: e.isActive({ textAlign: "justify" }),
      table: e.isActive("table"),
      image: e.isActive("image"),
      fontFamily: (e.getAttributes("textStyle").fontFamily as string) || "",
      fontSize: (e.getAttributes("textStyle").fontSize as string) || "",
      color: (e.getAttributes("textStyle").color as string) || null,
      highlight: (e.getAttributes("highlight").color as string) || null,
      lineHeight:
        (e.getAttributes("paragraph").lineHeight as number | null) ??
        (e.getAttributes("heading").lineHeight as number | null) ??
        null,
      heading: (e.getAttributes("heading").level as number | undefined) ?? 0,
      imageWidth: (e.getAttributes("image").width as number | undefined) ?? 100,
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  if (!s) return null;

  const currentFont =
    DOCUMENT_FONTS.find((f) => f.family === s.fontFamily)?.id ?? defaultFontId;
  const currentSize = s.fontSize
    ? String(parseFloat(s.fontSize))
    : String(defaultSize);
  const chain = () => editor.chain().focus();

  async function pickImage(file: File) {
    try {
      const src = await fileToDocumentImage(file);
      chain().setImage({ src }).run();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the image.");
    }
  }

  function setLink() {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link address", prev ?? "https://");
    if (url === null) return;
    if (!url.trim() || url.trim() === "https://") {
      chain().unsetLink().run();
      return;
    }
    chain().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  return (
    <div className="border-border bg-card shrink-0 border-b">
      <div className="flex flex-wrap items-center gap-y-1 px-3 py-1.5">
        <Group>
          <Tool
            label="Undo"
            disabled={!s.canUndo}
            onClick={() => chain().undo().run()}
          >
            <Undo2 className="size-4" />
          </Tool>
          <Tool
            label="Redo"
            disabled={!s.canRedo}
            onClick={() => chain().redo().run()}
          >
            <Redo2 className="size-4" />
          </Tool>
        </Group>

        <Group>
          <SelectField
            ariaLabel="Paragraph style"
            value={String(s.heading)}
            onChange={(v) => {
              const level = Number(v);
              if (level === 0) chain().setParagraph().run();
              else
                chain()
                  .setHeading({ level: level as 1 | 2 | 3 | 4 })
                  .run();
            }}
            options={[
              { value: "0", label: "Normal text" },
              { value: "1", label: "Heading 1" },
              { value: "2", label: "Heading 2" },
              { value: "3", label: "Heading 3" },
              { value: "4", label: "Heading 4" },
            ]}
            className="h-7 w-32 text-xs"
          />
          <SelectField
            ariaLabel="Font"
            value={currentFont}
            onChange={(id) => {
              const f = fontById(id);
              if (id === defaultFontId) chain().unsetFontFamily().run();
              else chain().setFontFamily(f.family).run();
            }}
            options={DOCUMENT_FONTS.map((f) => ({
              value: f.id,
              label: f.label,
            }))}
            className="h-7 w-40 text-xs"
          />
          <SelectField
            ariaLabel="Font size"
            value={currentSize}
            onChange={(v) => {
              if (Number(v) === defaultSize) chain().unsetFontSize().run();
              else chain().setFontSize(`${v}pt`).run();
            }}
            options={FONT_SIZES.map((n) => ({
              value: String(n),
              label: String(n),
            }))}
            className="h-7 w-[4.5rem] text-xs"
          />
        </Group>

        <Group>
          <Tool
            label="Bold (Ctrl+B)"
            on={s.bold}
            onClick={() => chain().toggleBold().run()}
          >
            <Bold className="size-4" />
          </Tool>
          <Tool
            label="Italic (Ctrl+I)"
            on={s.italic}
            onClick={() => chain().toggleItalic().run()}
          >
            <Italic className="size-4" />
          </Tool>
          <Tool
            label="Underline (Ctrl+U)"
            on={s.underline}
            onClick={() => chain().toggleUnderline().run()}
          >
            <Underline className="size-4" />
          </Tool>
          <Tool
            label="Strikethrough"
            on={s.strike}
            onClick={() => chain().toggleStrike().run()}
          >
            <Strikethrough className="size-4" />
          </Tool>
          <Tool
            label="Subscript"
            on={s.sub}
            onClick={() => chain().toggleSubscript().run()}
          >
            <Subscript className="size-4" />
          </Tool>
          <Tool
            label="Superscript"
            on={s.sup}
            onClick={() => chain().toggleSuperscript().run()}
          >
            <Superscript className="size-4" />
          </Tool>
          <Swatches
            label="Text colour"
            colours={TEXT_COLOURS}
            current={s.color}
            icon={<Baseline className="size-4" />}
            onPick={(c) => chain().setColor(c).run()}
            onClear={() => chain().unsetColor().run()}
          />
          <Swatches
            label="Highlight"
            colours={HIGHLIGHTS}
            current={s.highlight}
            icon={<Highlighter className="size-4" />}
            onPick={(c) => chain().setHighlight({ color: c }).run()}
            onClear={() => chain().unsetHighlight().run()}
          />
          <Tool
            label="Clear formatting"
            onClick={() => chain().unsetAllMarks().clearNodes().run()}
          >
            <RemoveFormatting className="size-4" />
          </Tool>
        </Group>

        <Group>
          <Tool
            label="Align left"
            on={s.left}
            onClick={() => chain().setTextAlign("left").run()}
          >
            <AlignLeft className="size-4" />
          </Tool>
          <Tool
            label="Centre"
            on={s.center}
            onClick={() => chain().setTextAlign("center").run()}
          >
            <AlignCenter className="size-4" />
          </Tool>
          <Tool
            label="Align right"
            on={s.right}
            onClick={() => chain().setTextAlign("right").run()}
          >
            <AlignRight className="size-4" />
          </Tool>
          <Tool
            label="Justify"
            on={s.justify}
            onClick={() => chain().setTextAlign("justify").run()}
          >
            <AlignJustify className="size-4" />
          </Tool>
        </Group>

        <Group>
          <Tool
            label="Bulleted list"
            on={s.bullet}
            onClick={() => chain().toggleBulletList().run()}
          >
            <List className="size-4" />
          </Tool>
          <Tool
            label="Numbered list"
            on={s.ordered}
            onClick={() => chain().toggleOrderedList().run()}
          >
            <ListOrdered className="size-4" />
          </Tool>
          <Tool label="Decrease indent" onClick={() => chain().outdent().run()}>
            <Outdent className="size-4" />
          </Tool>
          <Tool label="Increase indent" onClick={() => chain().indent().run()}>
            <Indent className="size-4" />
          </Tool>
          <SelectField
            ariaLabel="Line spacing"
            value={s.lineHeight ? String(s.lineHeight) : "default"}
            onChange={(v) =>
              chain()
                .setParagraphLineHeight(v === "default" ? null : Number(v))
                .run()
            }
            options={[{ value: "default", label: "Spacing" }, ...LINE_HEIGHTS]}
            className="h-7 w-24 text-xs"
          />
          <Tool
            label="Quote"
            on={s.quote}
            onClick={() => chain().toggleBlockquote().run()}
          >
            <Quote className="size-4" />
          </Tool>
        </Group>

        <Group>
          <Tool label="Link" on={s.link} onClick={setLink}>
            <Link2 className="size-4" />
          </Tool>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground h-7 gap-1 px-2 text-xs"
                onMouseDown={(e) => e.preventDefault()}
              >
                Insert
                <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onSelect={() =>
                  chain()
                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                    .run()
                }
              >
                <TableIcon className="size-4" />
                Table (3 × 3)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
                <ImageIcon className="size-4" />
                Picture…
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => chain().setPageBreak().run()}>
                <Scissors className="size-4" />
                Page break
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => chain().setHorizontalRule().run()}
              >
                <Minus className="size-4" />
                Horizontal line
              </DropdownMenuItem>
              {onSaveVersion && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Document</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={onSaveVersion}>
                    File the current text as a version
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            aria-label="Picture file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pickImage(f);
              e.target.value = "";
            }}
          />
        </Group>
      </div>

      {s.table && (
        <div className="border-border flex flex-wrap items-center gap-1 border-t px-3 py-1 text-xs">
          <span className="text-muted-foreground mr-1">Table</span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => chain().addRowBefore().run()}
          >
            Row above
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => chain().addRowAfter().run()}
          >
            Row below
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => chain().addColumnBefore().run()}
          >
            Column left
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => chain().addColumnAfter().run()}
          >
            Column right
          </Button>
          <Separator orientation="vertical" className="mx-1 h-4!" />
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => chain().deleteRow().run()}
          >
            Delete row
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => chain().deleteColumn().run()}
          >
            Delete column
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => chain().toggleHeaderRow().run()}
          >
            Header row
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => chain().mergeOrSplit().run()}
          >
            Merge / split
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-destructive"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => chain().deleteTable().run()}
          >
            Delete table
          </Button>
        </div>
      )}

      {s.image && (
        <div className="border-border flex flex-wrap items-center gap-1 border-t px-3 py-1 text-xs">
          <span className="text-muted-foreground mr-1">Picture width</span>
          {[25, 33, 50, 75, 100].map((w) => (
            <Button
              key={w}
              type="button"
              variant={s.imageWidth === w ? "secondary" : "ghost"}
              size="xs"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                chain().updateAttributes("image", { width: w }).run()
              }
            >
              {w}%
            </Button>
          ))}
          <Separator orientation="vertical" className="mx-1 h-4!" />
          {(["left", "center", "right"] as const).map((a) => (
            <Button
              key={a}
              type="button"
              variant="ghost"
              size="xs"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                chain().updateAttributes("image", { align: a }).run()
              }
            >
              {a === "left" ? "Left" : a === "center" ? "Centre" : "Right"}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
