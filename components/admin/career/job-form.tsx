"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatApiError } from "@/lib/http/form-error";
import type { EmploymentType, JobStatus } from "@/lib/schemas/career";
import { LocalizedInput } from "@/components/admin/ui/localized-input";

type L = { en: string; bn: string; ja: string };
type LInit = { en?: string; bn?: string; ja?: string };

export type JobFormInitial = {
  id?: string;
  title?: LInit;
  slug?: string;
  department?: LInit;
  reportsTo?: LInit;
  location?: LInit;
  employmentType?: EmploymentType;
  experience?: LInit;
  vacancies?: string;
  summary?: LInit;
  description?: LInit;
  responsibilities?: LInit;
  requirements?: LInit;
  preferredSkills?: LInit;
  benefits?: LInit;
  applyEmail?: string;
  recruiterName?: string;
  recruiterTitle?: LInit;
  recruiterEmail?: string;
  recruiterPhone?: string;
  closesAt?: string; // YYYY-MM-DD
  status?: JobStatus;
};

const toL = (l?: LInit): L => ({
  en: l?.en ?? "",
  bn: l?.bn ?? "",
  ja: l?.ja ?? "",
});

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
  { value: "temporary", label: "Temporary" },
];

export function JobForm({ initial }: { initial?: JobFormInitial }) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const [title, setTitle] = useState<L>(toL(initial?.title));
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [department, setDepartment] = useState<L>(toL(initial?.department));
  const [reportsTo, setReportsTo] = useState<L>(toL(initial?.reportsTo));
  const [location, setLocation] = useState<L>(toL(initial?.location));
  const [employmentType, setEmploymentType] = useState<EmploymentType>(
    initial?.employmentType ?? "full_time",
  );
  const [experience, setExperience] = useState<L>(toL(initial?.experience));
  const [vacancies, setVacancies] = useState(initial?.vacancies ?? "");
  const [summary, setSummary] = useState<L>(toL(initial?.summary));
  const [description, setDescription] = useState<L>(toL(initial?.description));
  const [responsibilities, setResponsibilities] = useState<L>(
    toL(initial?.responsibilities),
  );
  const [requirements, setRequirements] = useState<L>(
    toL(initial?.requirements),
  );
  const [preferredSkills, setPreferredSkills] = useState<L>(
    toL(initial?.preferredSkills),
  );
  const [benefits, setBenefits] = useState<L>(toL(initial?.benefits));
  const [applyEmail, setApplyEmail] = useState(initial?.applyEmail ?? "");
  const [recruiterName, setRecruiterName] = useState(
    initial?.recruiterName ?? "",
  );
  const [recruiterTitle, setRecruiterTitle] = useState<L>(
    toL(initial?.recruiterTitle),
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
    <div className="grid max-w-[860px] gap-5">
      <section className="bg-card grid gap-4 rounded-lg border p-5">
        <BilingualField label="Title" value={title} onChange={setTitle} />
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label>Slug (optional)</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="auto from title"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Employment type</Label>
            <Select
              value={employmentType}
              onValueChange={(v) => setEmploymentType(v as EmploymentType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMPLOYMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
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
        <div className="grid grid-cols-2 gap-4">
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
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label>Vacancies (optional)</Label>
            <Input
              type="number"
              min={0}
              value={vacancies}
              onChange={(e) => setVacancies(e.target.value)}
              placeholder="e.g. 1"
            />
          </div>
          <div className="grid gap-1.5">
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

      <section className="bg-card grid gap-4 rounded-lg border p-5">
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

      <section className="bg-card grid gap-4 rounded-lg border p-5">
        <strong className="text-foreground font-[family-name:var(--font-display)] font-semibold">
          Recruiter (optional)
        </strong>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
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
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label>Recruiter email</Label>
            <Input
              value={recruiterEmail}
              onChange={(e) => setRecruiterEmail(e.target.value)}
              placeholder="careers@spibermed.com"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Recruiter phone</Label>
            <Input
              value={recruiterPhone}
              onChange={(e) => setRecruiterPhone(e.target.value)}
              placeholder="+880 1XXX-XXXXXX"
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>Apply email (optional — where applications are sent)</Label>
          <Input
            value={applyEmail}
            onChange={(e) => setApplyEmail(e.target.value)}
            placeholder="defaults to the careers inbox"
          />
        </div>
      </section>

      <section className="bg-card grid gap-4 rounded-lg border p-5">
        <div className="grid gap-1.5">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as JobStatus)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {error && <p className="text-destructive text-sm">{error}</p>}
      <div>
        <Button type="button" onClick={submit} disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save job" : "Create job"}
        </Button>
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
  // Thin adapter over the shared tabbed field: the form keeps its `{en,bn,ja}`
  // state while the control renders one input behind an EN/বাংলা/日本語 tab strip.
  return (
    <LocalizedInput
      label={label}
      value={value}
      textarea={textarea}
      rows={rows}
      onChange={(v) =>
        onChange({ en: v.en ?? "", bn: v.bn ?? "", ja: v.ja ?? "" })
      }
    />
  );
}
