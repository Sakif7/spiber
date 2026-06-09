"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CtaButton } from "@/components/ui/cta-button";
import { formatApiError } from "@/lib/http/form-error";
import type { EmploymentType, JobStatus } from "@/lib/schemas/career";

type L = { en: string; bn: string };

export type JobFormInitial = {
  id?: string;
  title?: L;
  slug?: string;
  department?: L;
  reportsTo?: L;
  location?: L;
  employmentType?: EmploymentType;
  experience?: L;
  vacancies?: string;
  summary?: L;
  description?: L;
  responsibilities?: L;
  requirements?: L;
  preferredSkills?: L;
  benefits?: L;
  applyEmail?: string;
  recruiterName?: string;
  recruiterTitle?: L;
  recruiterEmail?: string;
  recruiterPhone?: string;
  closesAt?: string; // YYYY-MM-DD
  status?: JobStatus;
};

const emptyL = (): L => ({ en: "", bn: "" });
const field: CSSProperties = { display: "grid", gap: 6 };
const row: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "var(--s-4)",
};
const card: CSSProperties = {
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  borderRadius: "var(--r-lg)",
  padding: "var(--s-5)",
  display: "grid",
  gap: "var(--s-4)",
};
const selStyle: CSSProperties = {
  height: 40,
  padding: "0 10px",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-sm)",
  font: "inherit",
  background: "var(--color-surface)",
};
const taStyle: CSSProperties = {
  font: "inherit",
  padding: "8px 10px",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-sm)",
  background: "var(--color-surface)",
  width: "100%",
  resize: "vertical",
};

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
  { value: "temporary", label: "Temporary" },
];

const cardTitle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  color: "var(--color-text-strong)",
};

export function JobForm({ initial }: { initial?: JobFormInitial }) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const [title, setTitle] = useState<L>(initial?.title ?? emptyL());
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [department, setDepartment] = useState<L>(
    initial?.department ?? emptyL(),
  );
  const [reportsTo, setReportsTo] = useState<L>(initial?.reportsTo ?? emptyL());
  const [location, setLocation] = useState<L>(initial?.location ?? emptyL());
  const [employmentType, setEmploymentType] = useState<EmploymentType>(
    initial?.employmentType ?? "full_time",
  );
  const [experience, setExperience] = useState<L>(
    initial?.experience ?? emptyL(),
  );
  const [vacancies, setVacancies] = useState(initial?.vacancies ?? "");
  const [summary, setSummary] = useState<L>(initial?.summary ?? emptyL());
  const [description, setDescription] = useState<L>(
    initial?.description ?? emptyL(),
  );
  const [responsibilities, setResponsibilities] = useState<L>(
    initial?.responsibilities ?? emptyL(),
  );
  const [requirements, setRequirements] = useState<L>(
    initial?.requirements ?? emptyL(),
  );
  const [preferredSkills, setPreferredSkills] = useState<L>(
    initial?.preferredSkills ?? emptyL(),
  );
  const [benefits, setBenefits] = useState<L>(initial?.benefits ?? emptyL());
  const [applyEmail, setApplyEmail] = useState(initial?.applyEmail ?? "");
  const [recruiterName, setRecruiterName] = useState(
    initial?.recruiterName ?? "",
  );
  const [recruiterTitle, setRecruiterTitle] = useState<L>(
    initial?.recruiterTitle ?? emptyL(),
  );
  const [recruiterEmail, setRecruiterEmail] = useState(
    initial?.recruiterEmail ?? "",
  );
  const [recruiterPhone, setRecruiterPhone] = useState(
    initial?.recruiterPhone ?? "",
  );
  const [closesAt, setClosesAt] = useState(initial?.closesAt ?? "");
  const [status, setStatus] = useState<JobStatus>(initial?.status ?? "draft");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function buildPayload() {
    const clean = (l: L) => ({ en: l.en.trim(), bn: l.bn.trim() || undefined });
    const optL = (l: L) => (l.en.trim() || l.bn.trim() ? clean(l) : undefined);
    return {
      title: clean(title),
      slug: slug.trim() || undefined,
      department: optL(department),
      reportsTo: optL(reportsTo),
      location: optL(location),
      employmentType,
      experience: optL(experience),
      vacancies: vacancies.trim() ? Number(vacancies) : undefined,
      summary: optL(summary),
      description: clean(description),
      responsibilities: optL(responsibilities),
      requirements: optL(requirements),
      preferredSkills: optL(preferredSkills),
      benefits: optL(benefits),
      applyEmail: applyEmail.trim() || undefined,
      recruiterName: recruiterName.trim() || undefined,
      recruiterTitle: optL(recruiterTitle),
      recruiterEmail: recruiterEmail.trim() || undefined,
      recruiterPhone: recruiterPhone.trim() || undefined,
      closesAt: closesAt || undefined,
      status,
    };
  }

  async function submit() {
    if (!title.en.trim()) {
      setError("Please fix — Title (EN): is required");
      return;
    }
    if (!description.en.trim()) {
      setError("Please fix — Description (EN): is required");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(
      isEdit ? `/api/admin/career/${initial!.id}` : "/api/admin/career",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      },
    );
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (res.ok && json?.ok) {
      router.push("/admin/career");
      router.refresh();
    } else {
      setError(formatApiError(json));
    }
  }

  return (
    <div style={{ display: "grid", gap: "var(--s-5)", maxWidth: 860 }}>
      <section style={card}>
        <BilingualField label="Title" value={title} onChange={setTitle} />
        <div style={row}>
          <div style={field}>
            <Label>Slug (optional)</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="auto from title"
            />
          </div>
          <div style={field}>
            <Label>Employment type</Label>
            <select
              value={employmentType}
              onChange={(e) =>
                setEmploymentType(e.target.value as EmploymentType)
              }
              style={selStyle}
            >
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={row}>
          <BilingualField
            label="Department (optional)"
            value={department}
            onChange={setDepartment}
          />
          <BilingualField
            label="Reports to (optional)"
            value={reportsTo}
            onChange={setReportsTo}
          />
        </div>
        <div style={row}>
          <BilingualField
            label="Location (optional)"
            value={location}
            onChange={setLocation}
          />
          <BilingualField
            label="Experience (optional, e.g. 3–5 years)"
            value={experience}
            onChange={setExperience}
          />
        </div>
        <div style={row}>
          <div style={field}>
            <Label>Vacancies (optional)</Label>
            <Input
              type="number"
              min={0}
              value={vacancies}
              onChange={(e) => setVacancies(e.target.value)}
              placeholder="e.g. 1"
            />
          </div>
          <div style={field}>
            <Label>Apply by (optional)</Label>
            <Input
              type="date"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </div>
        </div>
        <BilingualField
          label="Summary (optional)"
          value={summary}
          onChange={setSummary}
          textarea
        />
      </section>

      <section style={card}>
        <BilingualField
          label="About the role (description)"
          value={description}
          onChange={setDescription}
          textarea
          rows={5}
        />
        <BilingualField
          label="Key responsibilities (one per line)"
          value={responsibilities}
          onChange={setResponsibilities}
          textarea
          rows={5}
        />
        <BilingualField
          label="Required qualifications (one per line)"
          value={requirements}
          onChange={setRequirements}
          textarea
          rows={5}
        />
        <BilingualField
          label="Preferred skills (one per line, optional)"
          value={preferredSkills}
          onChange={setPreferredSkills}
          textarea
          rows={4}
        />
        <BilingualField
          label="What we offer / benefits (one per line, optional)"
          value={benefits}
          onChange={setBenefits}
          textarea
          rows={4}
        />
      </section>

      <section style={card}>
        <strong style={cardTitle}>Recruiter (optional)</strong>
        <div style={row}>
          <div style={field}>
            <Label>Recruiter name</Label>
            <Input
              value={recruiterName}
              onChange={(e) => setRecruiterName(e.target.value)}
              placeholder="e.g. Afsana Rahman"
              maxLength={120}
            />
          </div>
          <BilingualField
            label="Recruiter title"
            value={recruiterTitle}
            onChange={setRecruiterTitle}
          />
        </div>
        <div style={row}>
          <div style={field}>
            <Label>Recruiter email</Label>
            <Input
              value={recruiterEmail}
              onChange={(e) => setRecruiterEmail(e.target.value)}
              placeholder="careers@spibermed.com"
            />
          </div>
          <div style={field}>
            <Label>Recruiter phone</Label>
            <Input
              value={recruiterPhone}
              onChange={(e) => setRecruiterPhone(e.target.value)}
              placeholder="+880 1XXX-XXXXXX"
            />
          </div>
        </div>
        <div style={field}>
          <Label>Apply email (optional — where applications are sent)</Label>
          <Input
            value={applyEmail}
            onChange={(e) => setApplyEmail(e.target.value)}
            placeholder="defaults to the careers inbox"
          />
        </div>
      </section>

      <section style={card}>
        <div style={field}>
          <Label>Status</Label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as JobStatus)}
            style={selStyle}
          >
            <option value="draft">Draft</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </section>

      {error && <p style={{ color: "var(--color-error)" }}>{error}</p>}
      <div>
        <CtaButton onClick={submit}>
          {saving ? "Saving…" : isEdit ? "Save job" : "Create job"}
        </CtaButton>
      </div>
    </div>
  );
}

function BilingualField({
  label,
  value,
  onChange,
  textarea,
  rows = 2,
}: {
  label: string;
  value: L;
  onChange: (v: L) => void;
  textarea?: boolean;
  rows?: number;
}) {
  return (
    <div style={field}>
      <Label>{label}</Label>
      <div style={row}>
        {textarea ? (
          <>
            <textarea
              placeholder="EN"
              value={value.en}
              onChange={(e) => onChange({ ...value, en: e.target.value })}
              rows={rows}
              style={taStyle}
            />
            <textarea
              placeholder="বাংলা"
              value={value.bn}
              onChange={(e) => onChange({ ...value, bn: e.target.value })}
              rows={rows}
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
