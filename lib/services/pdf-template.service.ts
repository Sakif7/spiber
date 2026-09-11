import { logger } from "@/lib/log";
import type { IPdfTemplate } from "@/lib/models/pdfTemplate";
import type { Lean } from "@/lib/models/_shared";
import {
  stampAssetIds,
  templateDocSchema,
  type TemplateDoc,
  type TemplateKind,
  TEMPLATE_KINDS,
} from "@/lib/schemas/pdf-template";
import type { StampAssets } from "@/lib/pdf/types";
import { loadAssets } from "@/lib/services/pdf-asset.service";
import { DEFAULT_TEMPLATES, defaultTemplate } from "@/lib/pdf/engine/defaults";
import {
  deleteDraft,
  getDraft,
  getLatestPublished,
  getPublishedVersion,
  listPublished,
  maxPublishedVersion,
  publishDraft,
  upsertDraft,
  type PublishedSummary,
} from "@/lib/repositories/pdf-templates.repo";

/**
 * PDF templates: one working draft per document kind, and an append-only
 * history of published versions.
 *
 * Version 0 is the built-in template — the layout as it was hand-coded —
 * which is what renders until something is published and what every document
 * generated before templates existed re-renders with. It lives in code, so
 * production needs no seed and can never lose it.
 */

export type ResolvedTemplate = {
  kind: TemplateKind;
  /** 0 = built-in. */
  version: number;
  template: TemplateDoc;
  /** The template's stamp images, decrypted, ready for the renderer. */
  assets: StampAssets;
};

/** Everything a renderer needs for this template, stamps included. */
export async function withAssets(
  r: Omit<ResolvedTemplate, "assets">,
): Promise<ResolvedTemplate> {
  return { ...r, assets: await loadAssets(stampAssetIds(r.template)) };
}

export type TemplateError = "no_draft" | "draft_gone" | "not_found" | "invalid";
export type TemplateResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: TemplateError; issues?: unknown };

const fail = (
  code: TemplateError,
  issues?: unknown,
): TemplateResult<never> => ({
  ok: false,
  code,
  issues,
});
const done = <T>(data: T): TemplateResult<T> => ({ ok: true, data });

type Actor = { sub: string };

function toDoc(row: Lean<IPdfTemplate>): TemplateDoc {
  return {
    documentTitle: row.documentTitle,
    theme: row.theme,
    blocks: row.blocks,
  };
}

const builtin = (kind: TemplateKind): ResolvedTemplate => ({
  kind,
  version: 0,
  template: DEFAULT_TEMPLATES[kind],
  assets: {},
});

/** The template a new document is drawn with: latest published, else built-in. */
export async function getCurrentTemplate(
  kind: TemplateKind,
): Promise<ResolvedTemplate> {
  const latest = await getLatestPublished(kind).catch((err) => {
    logger.warn("pdf-template: falling back to built-in", { kind, err });
    return null;
  });
  if (!latest || latest.version == null) return builtin(kind);
  return withAssets({ kind, version: latest.version, template: toDoc(latest) });
}

/**
 * The exact template a stored document was drawn with.
 *
 * Never throws: a document generated before templates existed carries no
 * version (→ built-in), and a version that cannot be found — which should not
 * happen, published rows are never deleted — logs and falls back rather than
 * refusing to reproduce an invoice a client holds.
 */
export async function getTemplateForRender(
  kind: TemplateKind,
  version: number | null | undefined,
): Promise<ResolvedTemplate> {
  if (!version) return builtin(kind);
  const row = await getPublishedVersion(kind, version).catch(() => null);
  if (!row) {
    logger.warn("pdf-template: pinned version missing, using built-in", {
      kind,
      version,
    });
    return builtin(kind);
  }
  return withAssets({ kind, version, template: toDoc(row) });
}

export type TemplateOverview = {
  kind: TemplateKind;
  current: ResolvedTemplate;
  draft: {
    template: TemplateDoc;
    updatedAt: Date;
    baseVersion: number | null;
  } | null;
  versions: PublishedSummary[];
  builtin: TemplateDoc;
};

export async function getOverview(
  kind: TemplateKind,
): Promise<TemplateOverview> {
  const [current, draft, versions] = await Promise.all([
    getCurrentTemplate(kind),
    getDraft(kind),
    listPublished(kind),
  ]);
  return {
    kind,
    current,
    draft: draft
      ? {
          template: toDoc(draft),
          updatedAt: draft.updatedAt,
          baseVersion: draft.baseVersion ?? null,
        }
      : null,
    versions,
    builtin: DEFAULT_TEMPLATES[kind],
  };
}

export type TemplateListRow = {
  kind: TemplateKind;
  currentVersion: number;
  hasDraft: boolean;
  draftUpdatedAt: Date | null;
  lastPublishedAt: Date | null;
};

export async function listOverview(): Promise<TemplateListRow[]> {
  return Promise.all(
    TEMPLATE_KINDS.map(async (kind) => {
      const [latest, draft] = await Promise.all([
        getLatestPublished(kind),
        getDraft(kind),
      ]);
      return {
        kind,
        currentVersion: latest?.version ?? 0,
        hasDraft: Boolean(draft),
        draftUpdatedAt: draft?.updatedAt ?? null,
        lastPublishedAt: latest?.publishedAt ?? null,
      };
    }),
  );
}

const isDuplicateKey = (err: unknown) =>
  typeof err === "object" &&
  err !== null &&
  (err as { code?: number }).code === 11000;

/** Save the working copy. Two tabs racing the one-draft index: last write wins. */
export async function saveDraft(
  kind: TemplateKind,
  doc: TemplateDoc,
  actor: Actor,
  baseVersion: number | null = null,
): Promise<TemplateResult<{ updatedAt: Date }>> {
  const parsed = templateDocSchema.safeParse(doc);
  if (!parsed.success) return fail("invalid", parsed.error.issues);
  // Which published version the edit started from — informational, so the
  // history can say "v4, edited from v2".
  const base = baseVersion ?? (await getCurrentTemplate(kind)).version;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const row = await upsertDraft(kind, parsed.data, actor.sub, base);
      return done({ updatedAt: row.updatedAt });
    } catch (err) {
      if (!isDuplicateKey(err) || attempt === 1) throw err;
    }
  }
  throw new Error("unreachable");
}

export async function discardDraft(
  kind: TemplateKind,
): Promise<TemplateResult<{ deleted: boolean }>> {
  return done({ deleted: await deleteDraft(kind) });
}

export async function getTemplateVersion(
  kind: TemplateKind,
  version: number,
): Promise<
  (ResolvedTemplate & { publishedAt: Date | null; note: string | null }) | null
> {
  if (version === 0) {
    return {
      ...builtin(kind),
      template: defaultTemplate(kind),
      publishedAt: null,
      note: null,
    };
  }
  const row = await getPublishedVersion(kind, version);
  if (!row) return null;
  return {
    kind,
    version,
    template: toDoc(row),
    assets: {},
    publishedAt: row.publishedAt ?? null,
    note: row.note ?? null,
  };
}

/**
 * Publish the draft as the next version.
 *
 * No transactions on this deployment, so the number is claimed by the unique
 * `(kind, version)` index: read the max, attempt max+1, and on a duplicate
 * key (a concurrent publish won) read again. The draft row itself becomes the
 * published row through a conditional update, so a draft discarded meanwhile
 * cannot be published.
 */
export async function publish(
  kind: TemplateKind,
  actor: Actor,
  note?: string | null,
): Promise<TemplateResult<{ version: number; baseVersion: number | null }>> {
  const draft = await getDraft(kind);
  if (!draft) return fail("no_draft");
  // A draft written by an older schema must not become a broken published
  // version that every future invoice is drawn with.
  const parsed = templateDocSchema.safeParse(toDoc(draft));
  if (!parsed.success) return fail("invalid", parsed.error.issues);

  for (let attempt = 0; attempt < 3; attempt++) {
    const next = (await maxPublishedVersion(kind)) + 1;
    try {
      const row = await publishDraft(
        String(draft._id),
        next,
        actor.sub,
        note?.trim() || null,
      );
      if (!row) return fail("draft_gone");
      return done({ version: next, baseVersion: draft.baseVersion ?? null });
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
    }
  }
  throw new Error("pdf-template: could not claim a version number");
}
