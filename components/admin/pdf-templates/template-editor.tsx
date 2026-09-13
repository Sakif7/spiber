"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  History,
  MoreHorizontal,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  EditorHeader,
  FormField,
  SaveBar,
} from "@/components/admin/ui/form-shell";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable } from "@/components/admin/ui/data-table";
import { useUnsavedGuard } from "@/components/admin/ui/unsaved-changes";
import { formatApiError } from "@/lib/http/form-error";
import { KIND_LABEL, newBlock } from "@/lib/pdf/engine/catalogue";
import {
  FIXED_BLOCK_TYPES,
  type Block,
  type BlockType,
  type TemplateDoc,
  type TemplateKind,
} from "@/lib/schemas/pdf-template";
import { BlockForm } from "./block-form";
import { BlockList } from "./block-list";
import type { StampAssetSummary } from "./stamp-form";
import { PreviewPane } from "./preview-pane";
import { usePdfPreview } from "./use-pdf-preview";
import { ThemeForm } from "./theme-form";

export type VersionSummary = {
  version: number;
  publishedAt: string | null;
  note: string | null;
  baseVersion: number | null;
};

export type EditorInitial = {
  kind: TemplateKind;
  current: { version: number; template: TemplateDoc };
  draft: {
    template: TemplateDoc;
    updatedAt: string;
    baseVersion: number | null;
  } | null;
  versions: VersionSummary[];
  builtin: TemplateDoc;
  assets: StampAssetSummary[];
};

const API = "/api/admin/company/pdf-templates";

const versionLabel = (v: number) => (v === 0 ? "built-in" : `v${v}`);

/**
 * The template editor.
 *
 * Three columns: the document's outline, the inspector for whatever is
 * selected (or the theme), and a live preview. The working document lives
 * here as one immutable value; "dirty" is derived by comparing it with what
 * was last saved, never tracked by hand.
 */
export function PdfTemplateEditor({ initial }: { initial: EditorInitial }) {
  const router = useRouter();
  const { kind } = initial;
  const start = initial.draft?.template ?? initial.current.template;

  const [doc, setDoc] = useState<TemplateDoc>(start);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(start));
  const [selectedId, setSelectedId] = useState<string | null>(
    start.blocks.find((b) => !FIXED_BLOCK_TYPES.has(b.type))?.id ?? null,
  );
  const [tab, setTab] = useState<"block" | "theme">("block");
  const [busy, setBusy] = useState<
    null | "save" | "publish" | "discard" | "load"
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<
    "none" | "publish" | "versions" | "discard"
  >("none");
  const [note, setNote] = useState("");
  const [assets, setAssets] = useState<StampAssetSummary[]>(initial.assets);
  const preview = usePdfPreview(kind, doc);

  const currentJson = JSON.stringify(doc);
  const dirty = currentJson !== savedJson;
  const hasDraft = Boolean(initial.draft) || dirty;
  const selected = doc.blocks.find((b) => b.id === selectedId) ?? null;

  const setBlocks = (blocks: Block[]) => setDoc((d) => ({ ...d, blocks }));
  const replaceBlock = (next: Block) =>
    setBlocks(doc.blocks.map((b) => (b.id === next.id ? next : b)));

  function addBlock(type: BlockType) {
    const block = newBlock(type, kind, doc.blocks);
    const at = selectedId
      ? doc.blocks.findIndex((b) => b.id === selectedId)
      : -1;
    const blocks = [...doc.blocks];
    blocks.splice(at >= 0 ? at + 1 : blocks.length, 0, block);
    setBlocks(blocks);
    setSelectedId(block.id);
    setTab("block");
  }

  async function call(path: string, init: RequestInit) {
    const res = await fetch(`${API}/${kind}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) throw new Error(formatApiError(json));
    return json.data as Record<string, unknown>;
  }

  async function saveDraft() {
    setBusy("save");
    setError(null);
    try {
      await call("/draft", { method: "PUT", body: currentJson });
      setSavedJson(currentJson);
      toast.success("Draft saved");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    setBusy("publish");
    setError(null);
    try {
      if (dirty || !initial.draft) {
        await call("/draft", { method: "PUT", body: currentJson });
      }
      const data = await call("/publish", {
        method: "POST",
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      setSavedJson(currentJson);
      setDialog("none");
      setNote("");
      toast.success(`Published ${versionLabel(Number(data.version))}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish");
    } finally {
      setBusy(null);
    }
  }

  async function discardDraft() {
    setBusy("discard");
    setError(null);
    try {
      await call("/draft", { method: "DELETE" });
      const back = initial.current.template;
      setDoc(back);
      setSavedJson(JSON.stringify(back));
      setSelectedId(
        back.blocks.find((b) => !FIXED_BLOCK_TYPES.has(b.type))?.id ?? null,
      );
      setDialog("none");
      toast.success("Draft discarded");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not discard");
    } finally {
      setBusy(null);
    }
  }

  async function loadVersion(version: number) {
    setBusy("load");
    setError(null);
    try {
      const data = await call(`/versions/${version}`, { method: "GET" });
      const template = data.template as TemplateDoc;
      setDoc(template);
      setSelectedId(
        template.blocks.find((b) => !FIXED_BLOCK_TYPES.has(b.type))?.id ?? null,
      );
      setDialog("none");
      toast.success(
        `Loaded ${versionLabel(version)} — save or publish to keep it`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load");
    } finally {
      setBusy(null);
    }
  }

  useUnsavedGuard(dirty, saveDraft);

  const subtitle = (
    <>
      Current: {versionLabel(initial.current.version)}
      {initial.draft
        ? ` · draft saved ${new Date(initial.draft.updatedAt).toLocaleString()}`
        : ""}
      {dirty ? " · unsaved changes" : ""}
    </>
  );

  return (
    <div className="grid gap-4">
      <EditorHeader
        backHref="/admin/company/pdf-templates"
        backLabel="PDF templates"
        title={`${KIND_LABEL[kind]} template`}
        subtitle={subtitle}
        action={
          <>
            <StatusBadge
              tone={initial.current.version === 0 ? "neutral" : "success"}
            >
              {initial.current.version === 0
                ? "Built-in"
                : `Published v${initial.current.version}`}
            </StatusBadge>
            {hasDraft && <StatusBadge tone="warning">Draft</StatusBadge>}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-w-0">
          <BlockList
            blocks={doc.blocks}
            selectedId={tab === "block" ? selectedId : null}
            onSelect={(id) => {
              setSelectedId(id);
              setTab("block");
            }}
            onChange={setBlocks}
            onAdd={addBlock}
            assets={assets}
          />
        </div>

        <div className="min-w-0">
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as "block" | "theme")}
          >
            <TabsList className="mb-3">
              <TabsTrigger value="block">Block</TabsTrigger>
              <TabsTrigger value="theme">Theme</TabsTrigger>
            </TabsList>
            <TabsContent value="block">
              {selected ? (
                <BlockForm
                  key={selected.id}
                  block={selected}
                  kind={kind}
                  onChange={replaceBlock}
                  stamp={{
                    blocks: doc.blocks,
                    theme: doc.theme,
                    assets,
                    preview,
                    onAssetUploaded: (a) => setAssets((list) => [a, ...list]),
                  }}
                />
              ) : (
                <p className="text-muted-foreground py-4 text-sm">
                  Select a block on the left to edit it.
                </p>
              )}
            </TabsContent>
            <TabsContent value="theme">
              <ThemeForm
                theme={doc.theme}
                onChange={(theme) => setDoc((d) => ({ ...d, theme }))}
              />
            </TabsContent>
          </Tabs>
        </div>

        <div className="min-w-0">
          <PreviewPane preview={preview} />
        </div>
      </div>

      <SaveBar
        saving={busy === "save"}
        onSave={saveDraft}
        saveLabel="Save draft"
        error={error}
        disabled={busy !== null || !dirty}
      >
        {/* Non-modal: a modal menu scroll-locks <body>, and with the site's
            `html { overflow-x: clip }` that turns body into the sticky
            containing block — the save bar (and this menu) drop off-screen
            the moment the menu opens. */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="More actions"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top">
            <DropdownMenuItem onSelect={() => setDialog("versions")}>
              <History className="size-4" />
              Revert to a version…
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setDoc(initial.builtin);
                setSelectedId(
                  initial.builtin.blocks.find(
                    (b) => !FIXED_BLOCK_TYPES.has(b.type),
                  )?.id ?? null,
                );
                toast.success(
                  "Built-in layout loaded — save or publish to keep it",
                );
              }}
            >
              <RotateCcw className="size-4" />
              Reset to built-in
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={!hasDraft}
              onSelect={() => setDialog("discard")}
            >
              <Trash2 className="size-4" />
              Discard draft
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          type="button"
          variant="outline"
          disabled={busy !== null || !hasDraft}
          onClick={() => setDialog("publish")}
        >
          <Upload className="size-4" />
          Publish…
        </Button>
      </SaveBar>

      <Dialog
        open={dialog === "publish"}
        onOpenChange={(o) => !o && setDialog("none")}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Publish this template</DialogTitle>
            <DialogDescription>
              Every {KIND_LABEL[kind].toLowerCase()} generated from now on uses
              it. Documents already generated keep the layout they were issued
              with.
            </DialogDescription>
          </DialogHeader>
          <FormField
            label="Note"
            hint="Optional — what changed, for the history."
          >
            <Input
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. wider specification column"
            />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog("none")}>
              Cancel
            </Button>
            <Button onClick={publish} disabled={busy !== null}>
              {busy === "publish" ? "Publishing…" : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "discard"}
        onOpenChange={(o) => !o && setDialog("none")}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Discard the draft?</DialogTitle>
            <DialogDescription>
              Unsaved and saved draft changes are thrown away. The published
              template is not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog("none")}>
              Keep editing
            </Button>
            <Button
              variant="destructive"
              onClick={discardDraft}
              disabled={busy !== null}
            >
              {busy === "discard" ? "Discarding…" : "Discard"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "versions"}
        onOpenChange={(o) => !o && setDialog("none")}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Published versions</DialogTitle>
            <DialogDescription>
              Loading one replaces what you are editing; nothing is published
              until you say so.
            </DialogDescription>
          </DialogHeader>
          <DataTable
            rows={[
              ...initial.versions,
              {
                version: 0,
                publishedAt: null,
                note: "The layout as coded",
                baseVersion: null,
              },
            ]}
            getRowKey={(r) => String(r.version)}
            minWidth={0}
            columns={[
              {
                key: "version",
                header: "Version",
                cell: (r) => (
                  <span className="font-medium">{versionLabel(r.version)}</span>
                ),
              },
              {
                key: "published",
                header: "Published",
                cell: (r) =>
                  r.publishedAt
                    ? new Date(r.publishedAt).toLocaleString()
                    : "—",
              },
              {
                key: "note",
                header: "Note",
                cell: (r) => (
                  <span className="text-muted-foreground">
                    {r.note ?? "—"}
                    {r.baseVersion != null && r.version !== 0
                      ? ` (from ${versionLabel(r.baseVersion)})`
                      : ""}
                  </span>
                ),
              },
              {
                key: "load",
                header: "",
                align: "right",
                cell: (r) => (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy !== null}
                    onClick={() => loadVersion(r.version)}
                  >
                    Load
                  </Button>
                ),
              },
            ]}
            empty="No published versions yet."
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
