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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { fromMinor, toMinor } from "@/lib/money";
import { formatApiError } from "@/lib/http/form-error";
import { cn } from "@/lib/cn";
import type {
  CourseLevel,
  CourseStatus,
  LessonType,
} from "@/lib/schemas/academy";
import { LocalizedInput, type LocalizedValue } from "../ui/localized-input";
import { SelectField } from "../ui/select-field";
import {
  EditorForm,
  FormField,
  FormGrid,
  FormSection,
  SaveBar,
} from "../ui/form-shell";
import { SingleImageField, UploadButton } from "../upload-fields";

// ---- Builder-local shapes (every field present, edited freely) ----
type L = { en: string; bn: string; ja: string };
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

const emptyL = (): L => ({ en: "", bn: "", ja: "" });
/** LocalizedInput hands back a partial value; the builder keeps all three. */
const fromLV = (v: LocalizedValue): L => ({
  en: v.en ?? "",
  bn: v.bn ?? "",
  ja: v.ja ?? "",
});
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

const LEVEL_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];
const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

/** Small uppercase caption used for "Module 1" / lesson type chips. */
function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-muted-foreground font-mono text-[11px] tracking-[0.12em] uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

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
    const clean = (l: L) => ({
      en: l.en.trim(),
      bn: l.bn.trim() || undefined,
      ja: l.ja.trim() || undefined,
    });
    const optL = (l: L) =>
      l.en.trim() || l.bn.trim() || l.ja.trim() ? clean(l) : undefined;
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

  /** Instant client-side check for the required fields the API also enforces. */
  function validate(): string | null {
    if (!title.en.trim()) return "Course title (EN) is required.";
    for (let mi = 0; mi < modules.length; mi++) {
      const m = modules[mi];
      if (!m.title.en.trim())
        return `Module ${mi + 1}: title (EN) is required.`;
      for (let li = 0; li < m.lessons.length; li++) {
        const l = m.lessons[li];
        if (!l.title.en.trim())
          return `Module ${mi + 1} → Lesson ${li + 1}: title (EN) is required.`;
        if (l.type === "quiz") {
          for (let qi = 0; qi < l.quiz.questions.length; qi++) {
            const q = l.quiz.questions[qi];
            if (!q.prompt.en.trim())
              return `Module ${mi + 1} → Lesson ${li + 1} → Question ${qi + 1}: prompt (EN) is required.`;
            if (q.options.some((o) => !o.text.en.trim()))
              return `Module ${mi + 1} → Lesson ${li + 1} → Question ${qi + 1}: every option needs text (EN).`;
            if (!q.correctOptionId)
              return `Module ${mi + 1} → Lesson ${li + 1} → Question ${qi + 1}: select the correct option.`;
          }
        }
      }
    }
    return null;
  }

  async function submit() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
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
      setError(formatApiError(json));
    }
  }

  const lessonCount = modules.reduce((n, m) => n + m.lessons.length, 0);

  return (
    <EditorForm className="max-w-5xl">
      <FormSection
        title="Course details"
        description="How the course is presented in the MedAcademy catalog."
      >
        <LocalizedInput
          label="Title"
          required
          value={title}
          onChange={(v) => setTitle(fromLV(v))}
          placeholder="e.g. Patient Monitoring Fundamentals"
        />
        <FormGrid>
          <FormField
            label="Slug (optional)"
            htmlFor="course-slug"
            hint="Leave blank to derive it from the English title."
          >
            <Input
              id="course-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="auto from title"
            />
          </FormField>
          <FormField
            label="Price (BDT)"
            htmlFor="course-price"
            hint="Zero enrols instantly; a paid course waits for an admin to mark it paid."
          >
            <Input
              id="course-price"
              type="number"
              value={priceMajor}
              onChange={(e) => setPriceMajor(e.target.value)}
            />
          </FormField>
        </FormGrid>
        <LocalizedInput
          label="Summary"
          value={summary}
          onChange={(v) => setSummary(fromLV(v))}
        />
        <LocalizedInput
          label="Description"
          textarea
          value={description}
          onChange={(v) => setDescription(fromLV(v))}
        />
        <FormGrid>
          <FormField label="Level">
            <SelectField
              value={level}
              onChange={(v) => setLevel(v as CourseLevel)}
              ariaLabel="Level"
              options={LEVEL_OPTIONS}
            />
          </FormField>
          <FormField label="Status">
            <SelectField
              value={status}
              onChange={(v) => setStatus(v as CourseStatus)}
              ariaLabel="Status"
              options={STATUS_OPTIONS}
            />
          </FormField>
        </FormGrid>
        <FormField label="Thumbnail">
          <SingleImageField value={thumbnail} onChange={setThumbnail} />
        </FormField>
      </FormSection>

      <FormSection
        title="Curriculum"
        description={
          modules.length === 0
            ? "Add a module to start building the curriculum."
            : `${modules.length} module${modules.length === 1 ? "" : "s"} · ${lessonCount} lesson${lessonCount === 1 ? "" : "s"} — drag to reorder.`
        }
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setModules((m) => [...m, newModule()])}
          >
            <Plus className="size-4" />
            Add module
          </Button>
        }
      >
        {modules.length === 0 ? (
          <p className="text-muted-foreground py-2 text-[13px]">
            No modules yet. A course can be saved as a draft without them.
          </p>
        ) : (
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
              <div className="grid gap-3">
                {modules.map((m, mi) => (
                  <Sortable key={m.id} id={m.id}>
                    {(handle) => (
                      <Card className="gap-0 p-0">
                        <div className="flex items-center gap-2 border-b px-3 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="text-muted-foreground cursor-grab"
                            aria-label="Drag module"
                            {...handle}
                          >
                            <GripVertical className="size-4" />
                          </Button>
                          <Eyebrow>Module {mi + 1}</Eyebrow>
                          <span className="text-foreground min-w-0 truncate text-[13px] font-medium">
                            {m.title.en || "Untitled module"}
                          </span>
                          <div className="ml-auto flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="text-muted-foreground"
                              onClick={() => moveModule(mi, mi - 1)}
                              disabled={mi === 0}
                              aria-label="Move up"
                            >
                              <ChevronUp className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="text-muted-foreground"
                              onClick={() => moveModule(mi, mi + 1)}
                              disabled={mi === modules.length - 1}
                              aria-label="Move down"
                            >
                              <ChevronDown className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                setModules((ms) =>
                                  ms.filter((x) => x.id !== m.id),
                                )
                              }
                              aria-label="Delete module"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-3 px-3 py-3">
                          <LocalizedInput
                            label="Module title"
                            required
                            value={m.title}
                            onChange={(v) =>
                              patchModule(m.id, { title: fromLV(v) })
                            }
                          />
                          <LessonList
                            module={m}
                            sensors={sensors}
                            onChange={(lessons) =>
                              patchModule(m.id, { lessons })
                            }
                            patchLesson={(lid, patch) =>
                              patchLesson(m.id, lid, patch)
                            }
                          />
                        </div>
                      </Card>
                    )}
                  </Sortable>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </FormSection>

      <SaveBar
        saving={saving}
        onSave={submit}
        error={error}
        saveLabel={isEdit ? "Save course" : "Create course"}
      />
    </EditorForm>
  );
}

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
    <div className="border-border/70 grid gap-2 border-l pl-3">
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
          <div className="grid gap-2">
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
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground mr-1 text-xs">Add lesson:</span>
        {(["video", "text", "quiz", "resource"] as LessonType[]).map((t) => (
          <Button
            key={t}
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs capitalize"
            onClick={() => addLesson(t)}
          >
            <Plus className="size-3.5" />
            {t}
          </Button>
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
    <div className="bg-muted/40 overflow-hidden rounded-md">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground cursor-grab"
          aria-label="Drag lesson"
          {...handle}
        >
          <GripVertical className="size-3.5" />
        </Button>
        <Eyebrow className="text-primary">{lesson.type}</Eyebrow>
        <span className="text-foreground min-w-0 truncate text-[13px]">
          {lesson.title.en || "Untitled lesson"}
        </span>
        {lesson.isFreePreview && (
          <Eyebrow className="text-[var(--color-secondary-deep)]">
            · preview
          </Eyebrow>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Close" : "Edit"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            aria-label="Delete lesson"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
      {open && (
        <div className="bg-card grid gap-4 border-t px-3 py-3">
          <LocalizedInput
            label="Lesson title"
            required
            value={lesson.title}
            onChange={(v) => patch({ title: fromLV(v) })}
          />
          <div className="flex items-center gap-2.5">
            <Switch
              id={`preview-${lesson.id}`}
              checked={lesson.isFreePreview}
              onCheckedChange={(v) => patch({ isFreePreview: v })}
            />
            <Label htmlFor={`preview-${lesson.id}`} className="font-normal">
              Free preview (viewable without enrolling)
            </Label>
          </div>
          {lesson.type === "video" && (
            <VideoField lesson={lesson} patch={patch} />
          )}
          {lesson.type === "text" && (
            <LocalizedInput
              label="Body"
              textarea
              rows={5}
              value={lesson.body}
              onChange={(v) => patch({ body: fromLV(v) })}
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
    <FormField
      label="Media (video / audio)"
      hint="Streamed through the enrollment-gated media route — never a public URL."
    >
      {lesson.videoUid ? (
        <div className="flex flex-wrap items-center gap-3 text-[13px]">
          <span className="text-muted-foreground">
            Uploaded · status:{" "}
            <strong className="text-foreground">
              {lesson.videoStatus || "ready"}
            </strong>
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => patch({ videoUid: "", videoStatus: "" })}
          >
            Replace
          </Button>
        </div>
      ) : (
        <UploadButton
          onFile={upload}
          busy={busy}
          label="Upload media"
          accept="video/*,audio/*"
        />
      )}
      {err && <p className="text-destructive text-xs">{err}</p>}
    </FormField>
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
    // Private: course resources are gated, never served from a public URL.
    fd.append("visibility", "private");
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
    <FormField label="Resources">
      <div className="grid gap-2">
        {lesson.resources.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              aria-label={`Resource ${i + 1} name`}
              value={r.name}
              onChange={(e) =>
                patch({
                  resources: lesson.resources.map((x, j) =>
                    j === i ? { ...x, name: e.target.value } : x,
                  ),
                })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove resource ${i + 1}`}
              className="text-muted-foreground hover:text-destructive shrink-0"
              onClick={() =>
                patch({
                  resources: lesson.resources.filter((_, j) => j !== i),
                })
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <UploadButton
          onFile={upload}
          busy={busy}
          label="Add file"
          accept="application/pdf,image/*"
        />
      </div>
    </FormField>
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
    <div className="grid gap-3">
      <FormField
        label="Pass mark (%)"
        htmlFor="quiz-pass"
        className="max-w-[12rem]"
      >
        <Input
          id="quiz-pass"
          type="number"
          value={quiz.passPercent}
          onChange={(e) =>
            onChange({ ...quiz, passPercent: Number(e.target.value) || 0 })
          }
        />
      </FormField>
      {quiz.questions.map((q, qi) => (
        <Card key={q.id} className="gap-0 p-0">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Eyebrow>Question {qi + 1}</Eyebrow>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-destructive ml-auto"
              aria-label={`Delete question ${qi + 1}`}
              onClick={() =>
                onChange({
                  ...quiz,
                  questions: quiz.questions.filter((x) => x.id !== q.id),
                })
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="grid gap-3 px-3 py-3">
            <LocalizedInput
              label="Prompt"
              required
              value={q.prompt}
              onChange={(v) => patchQ(q.id, { prompt: fromLV(v) })}
            />
            <FormField label="Options (select the correct one)">
              <div className="grid gap-2">
                {q.options.map((o, oi) => (
                  <div key={o.id} className="flex items-end gap-2">
                    <input
                      type="radio"
                      name={`correct-${q.id}`}
                      checked={q.correctOptionId === o.id}
                      onChange={() => patchQ(q.id, { correctOptionId: o.id })}
                      aria-label={`Option ${oi + 1} is correct`}
                      className="mb-2.5 size-4 shrink-0 accent-[var(--color-brand)]"
                    />
                    <LocalizedInput
                      className="min-w-0 flex-1"
                      ariaLabel={`Option ${oi + 1}`}
                      value={o.text}
                      placeholder={`Option ${oi + 1}`}
                      onChange={(v) =>
                        patchQ(q.id, {
                          options: q.options.map((x) =>
                            x.id === o.id ? { ...x, text: fromLV(v) } : x,
                          ),
                        })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      aria-label={`Remove option ${oi + 1}`}
                      disabled={q.options.length <= 2}
                      onClick={() =>
                        patchQ(q.id, {
                          options: q.options.filter((x) => x.id !== o.id),
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-fit"
                  onClick={() =>
                    patchQ(q.id, { options: [...q.options, newOption()] })
                  }
                >
                  <Plus className="size-4" />
                  Option
                </Button>
              </div>
            </FormField>
            <LocalizedInput
              label="Explanation (optional)"
              value={q.explanation}
              onChange={(v) => patchQ(q.id, { explanation: fromLV(v) })}
              hint="Shown after the learner answers."
            />
          </div>
        </Card>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() =>
          onChange({ ...quiz, questions: [...quiz.questions, newQuestion()] })
        }
      >
        <Plus className="size-4" />
        Add question
      </Button>
    </div>
  );
}
