"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "@/i18n/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CtaButton } from "@/components/ui/cta-button";
import { fromMinor, toMinor } from "@/lib/money";
import type {
  CourseLevel,
  CourseStatus,
  LessonType,
} from "@/lib/schemas/academy";

// ---- Builder-local shapes (every field present, edited freely) ----
type L = { en: string; bn: string };
type BOption = { id: string; text: L };
type BQuestion = {
  id: string;
  prompt: L;
  options: BOption[];
  correctOptionId: string;
  explanation: L;
};
type BQuiz = { passPercent: number; questions: BQuestion[] };
type BResource = { name: string; fileKey: string };
type BLesson = {
  id: string;
  title: L;
  type: LessonType;
  videoUid: string;
  videoStatus: string;
  durationSec?: number;
  body: L;
  resources: BResource[];
  isFreePreview: boolean;
  quiz: BQuiz;
};
type BModule = { id: string; title: L; lessons: BLesson[] };

export type CourseBuilderInitial = {
  id?: string;
  title?: L;
  slug?: string;
  summary?: L;
  description?: L;
  thumbnail?: string;
  level?: CourseLevel;
  priceMinor?: number;
  status?: CourseStatus;
  modules?: BModule[];
};

const cid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const emptyL = (): L => ({ en: "", bn: "" });
const newOption = (): BOption => ({ id: cid(), text: emptyL() });
const newQuestion = (): BQuestion => {
  const o1 = newOption();
  return {
    id: cid(),
    prompt: emptyL(),
    options: [o1, newOption()],
    correctOptionId: o1.id,
    explanation: emptyL(),
  };
};
const newLesson = (type: LessonType): BLesson => ({
  id: cid(),
  title: emptyL(),
  type,
  videoUid: "",
  videoStatus: "",
  body: emptyL(),
  resources: [],
  isFreePreview: false,
  quiz: { passPercent: 70, questions: [] },
});
const newModule = (): BModule => ({ id: cid(), title: emptyL(), lessons: [] });

const card: CSSProperties = {
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  borderRadius: "var(--r-lg)",
  padding: "var(--s-5)",
};
const sub: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--fs-caption)",
  textTransform: "uppercase",
  letterSpacing: "var(--tracking-eyebrow)",
  color: "var(--color-text-muted)",
};
const iconBtn: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 30,
  height: 30,
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text-muted)",
  cursor: "pointer",
};

function BilingualField({
  label,
  value,
  onChange,
  textarea,
}: {
  label: string;
  value: L;
  onChange: (v: L) => void;
  textarea?: boolean;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <Label>{label}</Label>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--s-3)",
        }}
      >
        {textarea ? (
          <>
            <textarea
              placeholder="EN"
              value={value.en}
              onChange={(e) => onChange({ ...value, en: e.target.value })}
              rows={3}
              style={taStyle}
            />
            <textarea
              placeholder="বাংলা"
              value={value.bn}
              onChange={(e) => onChange({ ...value, bn: e.target.value })}
              rows={3}
              style={taStyle}
            />
          </>
        ) : (
          <>
            <Input
              placeholder="EN"
              value={value.en}
              onChange={(e) => onChange({ ...value, en: e.target.value })}
            />
            <Input
              placeholder="বাংলা"
              value={value.bn}
              onChange={(e) => onChange({ ...value, bn: e.target.value })}
            />
          </>
        )}
      </div>
    </div>
  );
}

const taStyle: CSSProperties = {
  font: "inherit",
  padding: "8px 10px",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-sm)",
  background: "var(--color-surface)",
  width: "100%",
  resize: "vertical",
};

function Sortable({
  id,
  children,
}: {
  id: string;
  children: (
    handle: React.HTMLAttributes<HTMLButtonElement>,
  ) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({
        ...attributes,
        ...listeners,
      } as React.HTMLAttributes<HTMLButtonElement>)}
    </div>
  );
}

export function CourseBuilder({ initial }: { initial?: CourseBuilderInitial }) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const [title, setTitle] = useState<L>(initial?.title ?? emptyL());
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [summary, setSummary] = useState<L>(initial?.summary ?? emptyL());
  const [description, setDescription] = useState<L>(
    initial?.description ?? emptyL(),
  );
  const [thumbnail, setThumbnail] = useState(initial?.thumbnail ?? "");
  const [level, setLevel] = useState<CourseLevel>(initial?.level ?? "beginner");
  const [priceMajor, setPriceMajor] = useState(
    initial?.priceMinor != null ? String(fromMinor(initial.priceMinor)) : "0",
  );
  const [status, setStatus] = useState<CourseStatus>(
    initial?.status ?? "draft",
  );
  const [modules, setModules] = useState<BModule[]>(initial?.modules ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function patchModule(mid: string, patch: Partial<BModule>) {
    setModules((ms) => ms.map((m) => (m.id === mid ? { ...m, ...patch } : m)));
  }
  function patchLesson(mid: string, lid: string, patch: Partial<BLesson>) {
    setModules((ms) =>
      ms.map((m) =>
        m.id === mid
          ? {
              ...m,
              lessons: m.lessons.map((l) =>
                l.id === lid ? { ...l, ...patch } : l,
              ),
            }
          : m,
      ),
    );
  }
  function moveModule(from: number, to: number) {
    if (to < 0 || to >= modules.length) return;
    setModules((ms) => arrayMove(ms, from, to));
  }
  function onModuleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setModules((ms) => {
      const from = ms.findIndex((m) => m.id === active.id);
      const to = ms.findIndex((m) => m.id === over.id);
      return from < 0 || to < 0 ? ms : arrayMove(ms, from, to);
    });
  }

  function buildPayload() {
    const clean = (l: L) => ({ en: l.en.trim(), bn: l.bn.trim() || undefined });
    const optL = (l: L) => (l.en.trim() || l.bn.trim() ? clean(l) : undefined);
    return {
      title: clean(title),
      slug: slug.trim() || undefined,
      summary: optL(summary),
      description: optL(description),
      thumbnail: thumbnail || undefined,
      level,
      priceMinor: toMinor(Number(priceMajor) || 0),
      status,
      modules: modules.map((m) => ({
        id: m.id,
        title: clean(m.title),
        lessons: m.lessons.map((l) => ({
          id: l.id,
          title: clean(l.title),
          type: l.type,
          videoUid: l.videoUid || undefined,
          videoStatus: l.videoStatus || undefined,
          durationSec: l.durationSec,
          body: l.type === "text" ? optL(l.body) : undefined,
          resources: l.resources.filter((r) => r.name && r.fileKey),
          isFreePreview: l.isFreePreview,
          quiz:
            l.type === "quiz"
              ? {
                  passPercent: l.quiz.passPercent,
                  questions: l.quiz.questions.map((q) => ({
                    id: q.id,
                    prompt: clean(q.prompt),
                    options: q.options.map((o) => ({
                      id: o.id,
                      text: clean(o.text),
                    })),
                    correctOptionId: q.correctOptionId,
                    explanation: optL(q.explanation),
                  })),
                }
              : undefined,
        })),
      })),
    };
  }

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await fetch(
      isEdit
        ? `/api/admin/academy/courses/${initial!.id}`
        : "/api/admin/academy/courses",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      },
    );
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (res.ok && json?.ok) {
      router.push("/admin/courses");
      router.refresh();
    } else {
      setError(json?.error?.message ?? json?.error?.code ?? "save_failed");
    }
  }

  return (
    <div style={{ display: "grid", gap: "var(--s-6)", maxWidth: 920 }}>
      {/* Details */}
      <section style={{ ...card, display: "grid", gap: "var(--s-5)" }}>
        <BilingualField label="Title" value={title} onChange={setTitle} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--s-4)",
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <Label>Slug (optional)</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="auto from title"
            />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <Label>Price (BDT)</Label>
            <Input
              type="number"
              value={priceMajor}
              onChange={(e) => setPriceMajor(e.target.value)}
            />
          </div>
        </div>
        <BilingualField label="Summary" value={summary} onChange={setSummary} />
        <BilingualField
          label="Description"
          value={description}
          onChange={setDescription}
          textarea
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--s-4)",
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <Label>Level</Label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as CourseLevel)}
              style={selStyle}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <Label>Status</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CourseStatus)}
              style={selStyle}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <Label>Thumbnail</Label>
          <ImageField value={thumbnail} onChange={setThumbnail} />
        </div>
      </section>

      {/* Curriculum */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2
          style={{
            fontSize: "var(--fs-h4)",
            color: "var(--color-text-strong)",
            margin: 0,
          }}
        >
          Curriculum
        </h2>
        <button
          type="button"
          onClick={() => setModules((m) => [...m, newModule()])}
          style={addBtn}
        >
          <Plus size={15} /> Add module
        </button>
      </div>

      {modules.length === 0 && (
        <p
          style={{ color: "var(--color-text-muted)", fontSize: "var(--fs-sm)" }}
        >
          No modules yet. Add one to start building the curriculum.
        </p>
      )}

      <DndContext
        id="course-modules"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onModuleDragEnd}
      >
        <SortableContext
          items={modules.map((m) => m.id)}
          strategy={verticalListSortingStrategy}
        >
          <div style={{ display: "grid", gap: "var(--s-4)" }}>
            {modules.map((m, mi) => (
              <Sortable key={m.id} id={m.id}>
                {(handle) => (
                  <div style={{ ...card, display: "grid", gap: "var(--s-4)" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--s-3)",
                      }}
                    >
                      <button
                        type="button"
                        style={{ ...iconBtn, cursor: "grab" }}
                        {...handle}
                        aria-label="Drag module"
                      >
                        <GripVertical size={15} />
                      </button>
                      <span style={sub}>Module {mi + 1}</span>
                      <div
                        style={{ marginLeft: "auto", display: "flex", gap: 6 }}
                      >
                        <button
                          type="button"
                          style={iconBtn}
                          onClick={() => moveModule(mi, mi - 1)}
                          aria-label="Move up"
                        >
                          <ChevronUp size={15} />
                        </button>
                        <button
                          type="button"
                          style={iconBtn}
                          onClick={() => moveModule(mi, mi + 1)}
                          aria-label="Move down"
                        >
                          <ChevronDown size={15} />
                        </button>
                        <button
                          type="button"
                          style={{ ...iconBtn, color: "var(--color-error)" }}
                          onClick={() =>
                            setModules((ms) => ms.filter((x) => x.id !== m.id))
                          }
                          aria-label="Delete module"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    <BilingualField
                      label="Module title"
                      value={m.title}
                      onChange={(v) => patchModule(m.id, { title: v })}
                    />
                    <LessonList
                      module={m}
                      sensors={sensors}
                      onChange={(lessons) => patchModule(m.id, { lessons })}
                      patchLesson={(lid, patch) =>
                        patchLesson(m.id, lid, patch)
                      }
                    />
                  </div>
                )}
              </Sortable>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {error && (
        <p style={{ color: "var(--color-error)", fontSize: "var(--fs-sm)" }}>
          {error}
        </p>
      )}
      <div>
        <CtaButton onClick={submit}>
          {saving ? "Saving…" : isEdit ? "Save course" : "Create course"}
        </CtaButton>
      </div>
    </div>
  );
}

const selStyle: CSSProperties = {
  height: 40,
  padding: "0 10px",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-sm)",
  font: "inherit",
  background: "var(--color-surface)",
};
const addBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-brand-deep)",
  fontWeight: 600,
  fontSize: "var(--fs-sm)",
  cursor: "pointer",
};

// ---- Lessons within a module ----
function LessonList({
  module,
  sensors,
  onChange,
  patchLesson,
}: {
  module: BModule;
  sensors: ReturnType<typeof useSensors>;
  onChange: (lessons: BLesson[]) => void;
  patchLesson: (lid: string, patch: Partial<BLesson>) => void;
}) {
  const lessons = module.lessons;
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = lessons.findIndex((l) => l.id === active.id);
    const to = lessons.findIndex((l) => l.id === over.id);
    if (from >= 0 && to >= 0) onChange(arrayMove(lessons, from, to));
  }
  function addLesson(type: LessonType) {
    onChange([...lessons, newLesson(type)]);
  }

  return (
    <div
      style={{ display: "grid", gap: "var(--s-3)", paddingLeft: "var(--s-5)" }}
    >
      <DndContext
        id={`lessons-${module.id}`}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={lessons.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          <div style={{ display: "grid", gap: "var(--s-3)" }}>
            {lessons.map((l) => (
              <Sortable key={l.id} id={l.id}>
                {(handle) => (
                  <LessonCard
                    lesson={l}
                    handle={handle}
                    onDelete={() =>
                      onChange(lessons.filter((x) => x.id !== l.id))
                    }
                    patch={(patch) => patchLesson(l.id, patch)}
                  />
                )}
              </Sortable>
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(["video", "text", "quiz", "resource"] as LessonType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => addLesson(t)}
            style={{
              ...addBtn,
              padding: "6px 10px",
              textTransform: "capitalize",
            }}
          >
            <Plus size={13} /> {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function LessonCard({
  lesson,
  handle,
  onDelete,
  patch,
}: {
  lesson: BLesson;
  handle: React.HTMLAttributes<HTMLButtonElement>;
  onDelete: () => void;
  patch: (patch: Partial<BLesson>) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--r-md)",
        background: "var(--color-bg)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--s-3)",
          padding: "var(--s-3)",
        }}
      >
        <button
          type="button"
          style={{ ...iconBtn, cursor: "grab" }}
          {...handle}
          aria-label="Drag lesson"
        >
          <GripVertical size={14} />
        </button>
        <span style={{ ...sub, color: "var(--color-brand-deep)" }}>
          {lesson.type}
        </span>
        <span
          style={{
            fontSize: "var(--fs-sm)",
            color: "var(--color-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {lesson.title.en || "Untitled lesson"}
        </span>
        {lesson.isFreePreview && (
          <span style={{ ...sub, color: "var(--color-secondary-deep)" }}>
            · preview
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button
            type="button"
            style={iconBtn}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "−" : "Edit"}
          </button>
          <button
            type="button"
            style={{ ...iconBtn, color: "var(--color-error)" }}
            onClick={onDelete}
            aria-label="Delete lesson"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {open && (
        <div
          style={{
            display: "grid",
            gap: "var(--s-4)",
            padding: "var(--s-4)",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <BilingualField
            label="Lesson title"
            value={lesson.title}
            onChange={(v) => patch({ title: v })}
          />
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "var(--fs-sm)",
            }}
          >
            <input
              type="checkbox"
              checked={lesson.isFreePreview}
              onChange={(e) => patch({ isFreePreview: e.target.checked })}
            />
            Free preview (viewable without enrolling)
          </label>
          {lesson.type === "video" && (
            <VideoField lesson={lesson} patch={patch} />
          )}
          {lesson.type === "text" && (
            <BilingualField
              label="Body"
              value={lesson.body}
              onChange={(v) => patch({ body: v })}
              textarea
            />
          )}
          {lesson.type === "resource" && (
            <ResourceEditor lesson={lesson} patch={patch} />
          )}
          {lesson.type === "quiz" && (
            <QuizEditor
              quiz={lesson.quiz}
              onChange={(quiz) => patch({ quiz })}
            />
          )}
        </div>
      )}
    </div>
  );
}

function VideoField({
  lesson,
  patch,
}: {
  lesson: BLesson;
  patch: (p: Partial<BLesson>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function upload(file: File) {
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/academy/videos", {
      method: "POST",
      body: fd,
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok && json?.ok) {
      patch({
        videoUid: json.data.uid,
        videoStatus: json.data.status,
        durationSec: json.data.durationSec,
      });
    } else {
      setErr(json?.error?.code ?? "upload_failed");
    }
  }
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <Label>Media (video / audio)</Label>
      {lesson.videoUid ? (
        <div
          style={{ fontSize: "var(--fs-sm)", color: "var(--color-text-muted)" }}
        >
          Uploaded · status: <strong>{lesson.videoStatus || "ready"}</strong>
          <button
            type="button"
            style={{
              ...iconBtn,
              display: "inline-grid",
              marginLeft: 10,
              width: "auto",
              padding: "0 10px",
            }}
            onClick={() => patch({ videoUid: "", videoStatus: "" })}
          >
            Replace
          </button>
        </div>
      ) : (
        <label
          style={{
            ...addBtn,
            justifySelf: "start",
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "Uploading…" : "Upload media"}
          <input
            type="file"
            accept="video/*,audio/*"
            hidden
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </label>
      )}
      {err && (
        <span
          style={{ color: "var(--color-error)", fontSize: "var(--fs-caption)" }}
        >
          {err}
        </span>
      )}
    </div>
  );
}

function ResourceEditor({
  lesson,
  patch,
}: {
  lesson: BLesson;
  patch: (p: Partial<BLesson>) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function upload(file: File) {
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/uploads", { method: "POST", body: fd });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok && json?.ok) {
      // Store the raw storage key (not the public URL): course resources are
      // delivered through the enrollment-gated /api/media/resource route.
      patch({
        resources: [
          ...lesson.resources,
          { name: file.name, fileKey: json.data.key ?? json.data.url },
        ],
      });
    }
  }
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <Label>Resources</Label>
      {lesson.resources.map((r, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Input
            value={r.name}
            onChange={(e) =>
              patch({
                resources: lesson.resources.map((x, j) =>
                  j === i ? { ...x, name: e.target.value } : x,
                ),
              })
            }
          />
          <button
            type="button"
            style={{ ...iconBtn, color: "var(--color-error)" }}
            onClick={() =>
              patch({ resources: lesson.resources.filter((_, j) => j !== i) })
            }
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <label
        style={{
          ...addBtn,
          justifySelf: "start",
          cursor: busy ? "default" : "pointer",
        }}
      >
        {busy ? "Uploading…" : "+ Add file"}
        <input
          type="file"
          accept="application/pdf,image/*"
          hidden
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

function QuizEditor({
  quiz,
  onChange,
}: {
  quiz: BQuiz;
  onChange: (q: BQuiz) => void;
}) {
  function patchQ(qid: string, patch: Partial<BQuestion>) {
    onChange({
      ...quiz,
      questions: quiz.questions.map((q) =>
        q.id === qid ? { ...q, ...patch } : q,
      ),
    });
  }
  return (
    <div style={{ display: "grid", gap: "var(--s-4)" }}>
      <div style={{ display: "grid", gap: 6, maxWidth: 200 }}>
        <Label>Pass mark (%)</Label>
        <Input
          type="number"
          value={quiz.passPercent}
          onChange={(e) =>
            onChange({ ...quiz, passPercent: Number(e.target.value) || 0 })
          }
        />
      </div>
      {quiz.questions.map((q, qi) => (
        <div
          key={q.id}
          style={{
            ...card,
            padding: "var(--s-4)",
            display: "grid",
            gap: "var(--s-3)",
            background: "var(--color-surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={sub}>Question {qi + 1}</span>
            <button
              type="button"
              style={{
                ...iconBtn,
                marginLeft: "auto",
                color: "var(--color-error)",
              }}
              onClick={() =>
                onChange({
                  ...quiz,
                  questions: quiz.questions.filter((x) => x.id !== q.id),
                })
              }
            >
              <Trash2 size={14} />
            </button>
          </div>
          <BilingualField
            label="Prompt"
            value={q.prompt}
            onChange={(v) => patchQ(q.id, { prompt: v })}
          />
          <div style={{ display: "grid", gap: 8 }}>
            <Label>Options (select the correct one)</Label>
            {q.options.map((o, oi) => (
              <div
                key={o.id}
                style={{ display: "flex", gap: 8, alignItems: "center" }}
              >
                <input
                  type="radio"
                  name={`correct-${q.id}`}
                  checked={q.correctOptionId === o.id}
                  onChange={() => patchQ(q.id, { correctOptionId: o.id })}
                  aria-label={`Option ${oi + 1} correct`}
                />
                <Input
                  placeholder="EN"
                  value={o.text.en}
                  onChange={(e) =>
                    patchQ(q.id, {
                      options: q.options.map((x) =>
                        x.id === o.id
                          ? { ...x, text: { ...x.text, en: e.target.value } }
                          : x,
                      ),
                    })
                  }
                />
                <Input
                  placeholder="বাংলা"
                  value={o.text.bn}
                  onChange={(e) =>
                    patchQ(q.id, {
                      options: q.options.map((x) =>
                        x.id === o.id
                          ? { ...x, text: { ...x.text, bn: e.target.value } }
                          : x,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  style={{ ...iconBtn, color: "var(--color-error)" }}
                  disabled={q.options.length <= 2}
                  onClick={() =>
                    patchQ(q.id, {
                      options: q.options.filter((x) => x.id !== o.id),
                    })
                  }
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <button
              type="button"
              style={{ ...addBtn, padding: "6px 10px", justifySelf: "start" }}
              onClick={() =>
                patchQ(q.id, { options: [...q.options, newOption()] })
              }
            >
              <Plus size={13} /> Option
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        style={{ ...addBtn, justifySelf: "start" }}
        onClick={() =>
          onChange({ ...quiz, questions: [...quiz.questions, newQuestion()] })
        }
      >
        <Plus size={14} /> Add question
      </button>
    </div>
  );
}

function ImageField({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function upload(file: File) {
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/uploads", { method: "POST", body: fd });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok && json?.ok) onChange(json.data.url);
  }
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      {value && (
        // eslint-disable-next-line @next/next/no-img-element -- admin preview only
        <img
          src={value}
          alt=""
          style={{
            width: 96,
            height: 64,
            objectFit: "cover",
            borderRadius: "var(--r-sm)",
            border: "1px solid var(--color-border)",
          }}
        />
      )}
      <label style={{ ...addBtn, cursor: busy ? "default" : "pointer" }}>
        {busy ? "Uploading…" : value ? "Replace" : "Upload"}
        <input
          type="file"
          accept="image/*"
          hidden
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
      </label>
      {value && (
        <button
          type="button"
          style={iconBtn}
          onClick={() => onChange("")}
          aria-label="Remove"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
