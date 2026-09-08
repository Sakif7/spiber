"use client";

import { useState, type ReactNode } from "react";
import { useAfterSave } from "@/components/admin/ui/form-panel";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatApiError } from "@/lib/http/form-error";
import { SingleImageField } from "@/components/admin/upload-fields";
import { ImageUploader } from "@/components/admin/image-uploader";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ helpers */
type Loc = { en: string; bn?: string; ja?: string };
type Init = Record<string, unknown>;

function locValue(v: unknown): Loc {
  const o = (v ?? {}) as Loc;
  return { en: o.en ?? "", bn: o.bn ?? "", ja: o.ja ?? "" };
}
function locArrayToText(v: unknown): string {
  if (!Array.isArray(v)) return "";
  return (v as Loc[]).map((x) => x?.en ?? "").join("\n");
}
function textToLocArray(s: string): Loc[] {
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((en) => ({ en }));
}
function strArrayToText(v: unknown): string {
  return Array.isArray(v) ? (v as string[]).join("\n") : "";
}
function textToStrArray(s: string): string[] {
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}
function idListToText(v: unknown): string {
  return Array.isArray(v) ? (v as unknown[]).map(String).join(", ") : "";
}
function textToIdList(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Shared submit: POST (create) or PATCH (edit), then route. */
function useCatalogSubmit(
  pluralPath: string,
  id: string | undefined,
  listPath: string,
) {
  const afterSave = useAfterSave();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const url = id
        ? `/api/admin/tourism/${pluralPath}/${id}`
        : `/api/admin/tourism/${pluralPath}`;
      const res = await fetch(url, {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const msg = formatApiError(json);
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success("Saved");
      afterSave(id ? null : listPath);
    } catch {
      setError("Network error.");
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  }
  return { submit, busy, error };
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-muted-foreground text-xs font-medium">
        {label}
      </Label>
      {children}
    </div>
  );
}

function LocalizedField({
  label,
  value,
  onChange,
  textarea,
}: {
  label: string;
  value: Loc;
  onChange: (v: Loc) => void;
  textarea?: boolean;
}) {
  const C = textarea ? Textarea : Input;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={`${label} (EN)`}>
        <C
          value={value.en}
          onChange={(e) => onChange({ ...value, en: e.target.value })}
          rows={textarea ? 3 : undefined}
        />
      </Field>
      <Field label={`${label} (BN)`}>
        <C
          value={value.bn ?? ""}
          onChange={(e) => onChange({ ...value, bn: e.target.value })}
          rows={textarea ? 3 : undefined}
        />
      </Field>
      <Field label={`${label} (JA)`}>
        <C
          value={value.ja ?? ""}
          onChange={(e) => onChange({ ...value, ja: e.target.value })}
          rows={textarea ? 3 : undefined}
        />
      </Field>
    </div>
  );
}

function StatusSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label="Status">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="draft">Draft</SelectItem>
          <SelectItem value="active">Active</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="border-border bg-muted/30 flex items-center justify-between gap-3 rounded-lg border px-3.5 py-3">
      <span className="text-foreground text-sm font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function FormShell({
  busy,
  error,
  onSubmit,
  children,
}: {
  busy: boolean;
  error: string | null;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-5"
    >
      {children}
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="border-border flex items-center gap-3 border-t pt-4">
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

function costRangeFrom(init: Init) {
  const cr = (init.costRange ?? {}) as {
    bdtMinMinor?: number | null;
    bdtMaxMinor?: number | null;
    foreignLabel?: string;
  };
  return {
    min: cr.bdtMinMinor != null ? String(cr.bdtMinMinor / 100) : "",
    max: cr.bdtMaxMinor != null ? String(cr.bdtMaxMinor / 100) : "",
    foreign: cr.foreignLabel ?? "",
  };
}
function buildCostRange(min: string, max: string, foreign: string) {
  const out: Record<string, unknown> = {};
  if (min) out.bdtMinMinor = Math.round(parseFloat(min) * 100);
  if (max) out.bdtMaxMinor = Math.round(parseFloat(max) * 100);
  if (foreign) out.foreignLabel = foreign;
  return Object.keys(out).length ? out : undefined;
}

function CostRangeFields({
  min,
  max,
  foreign,
  set,
}: {
  min: string;
  max: string;
  foreign: string;
  set: (k: "min" | "max" | "foreign", v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="BDT min">
          <Input
            type="number"
            min={0}
            placeholder="e.g. 600000"
            value={min}
            onChange={(e) => set("min", e.target.value)}
          />
        </Field>
        <Field label="BDT max">
          <Input
            type="number"
            min={0}
            placeholder="e.g. 950000"
            value={max}
            onChange={(e) => set("max", e.target.value)}
          />
        </Field>
      </div>
      <Field label="Foreign estimate label">
        <Input
          placeholder="e.g. USD 5,000–8,000 (excl. airfare)"
          value={foreign}
          onChange={(e) => set("foreign", e.target.value)}
        />
      </Field>
    </div>
  );
}

/* -------------------------------------------------------------- Destination */
export function DestinationForm({
  id,
  initial = {},
}: {
  id?: string;
  initial?: Init;
}) {
  const { submit, busy, error } = useCatalogSubmit(
    "destinations",
    id,
    "/admin/tourism/destinations",
  );
  const [name, setName] = useState<Loc>(locValue(initial.name));
  const [slug, setSlug] = useState(String(initial.slug ?? ""));
  const [status, setStatus] = useState(String(initial.status ?? "draft"));
  const [featured, setFeatured] = useState(Boolean(initial.featured));
  const [heroImage, setHeroImage] = useState(String(initial.heroImage ?? ""));
  const [overview, setOverview] = useState<Loc>(locValue(initial.overview));
  const [treatments, setTreatments] = useState(
    locArrayToText(initial.popularTreatments),
  );
  const [hospitals, setHospitals] = useState(
    idListToText(initial.partnerHospitalIds),
  );
  const cr0 = costRangeFrom(initial);
  const [min, setMin] = useState(cr0.min);
  const [max, setMax] = useState(cr0.max);
  const [foreign, setForeign] = useState(cr0.foreign);

  return (
    <FormShell
      busy={busy}
      error={error}
      onSubmit={() =>
        submit({
          name,
          slug,
          status,
          featured,
          heroImage: heroImage || undefined,
          overview: overview.en ? overview : undefined,
          popularTreatments: textToLocArray(treatments),
          partnerHospitalIds: textToIdList(hospitals),
          costRange: buildCostRange(min, max, foreign),
        })
      }
    >
      <LocalizedField label="Name" value={name} onChange={setName} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Slug">
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
        </Field>
        <Field label="Hero image">
          <SingleImageField value={heroImage} onChange={setHeroImage} />
        </Field>
      </div>
      <LocalizedField
        label="Overview"
        value={overview}
        onChange={setOverview}
        textarea
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Popular treatments (one per line)">
          <Textarea
            value={treatments}
            onChange={(e) => setTreatments(e.target.value)}
            rows={4}
          />
        </Field>
        <Field label="Partner hospital IDs (comma-separated)">
          <Textarea
            value={hospitals}
            onChange={(e) => setHospitals(e.target.value)}
            rows={4}
          />
        </Field>
      </div>
      <CostRangeFields
        min={min}
        max={max}
        foreign={foreign}
        set={(k, v) =>
          k === "min" ? setMin(v) : k === "max" ? setMax(v) : setForeign(v)
        }
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <ToggleRow
          label="Featured destination"
          checked={featured}
          onChange={setFeatured}
        />
        <StatusSelect value={status} onChange={setStatus} />
      </div>
    </FormShell>
  );
}

/* ----------------------------------------------------------------- Hospital */
export function HospitalForm({
  id,
  initial = {},
}: {
  id?: string;
  initial?: Init;
}) {
  const { submit, busy, error } = useCatalogSubmit(
    "hospitals",
    id,
    "/admin/tourism/hospitals",
  );
  const [name, setName] = useState<Loc>(locValue(initial.name));
  const [slug, setSlug] = useState(String(initial.slug ?? ""));
  const [status, setStatus] = useState(String(initial.status ?? "draft"));
  const [country, setCountry] = useState<Loc>(locValue(initial.country));
  const [city, setCity] = useState<Loc>(locValue(initial.city));
  const [profile, setProfile] = useState<Loc>(locValue(initial.profile));
  const [accreditations, setAccreditations] = useState(
    strArrayToText(initial.accreditations),
  );
  const [specialties, setSpecialties] = useState(
    locArrayToText(initial.specialties),
  );
  const [images, setImages] = useState<string[]>(
    Array.isArray(initial.images) ? (initial.images as string[]) : [],
  );
  const [destinationId, setDestinationId] = useState(
    String(initial.destinationId ?? ""),
  );

  return (
    <FormShell
      busy={busy}
      error={error}
      onSubmit={() =>
        submit({
          name,
          slug,
          status,
          country,
          city: city.en ? city : undefined,
          profile: profile.en ? profile : undefined,
          accreditations: textToStrArray(accreditations),
          specialties: textToLocArray(specialties),
          images,
          destinationId: destinationId || undefined,
        })
      }
    >
      <LocalizedField label="Name" value={name} onChange={setName} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Slug">
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
        </Field>
        <Field label="Destination ID (optional)">
          <Input
            value={destinationId}
            onChange={(e) => setDestinationId(e.target.value)}
          />
        </Field>
      </div>
      <LocalizedField label="Country" value={country} onChange={setCountry} />
      <LocalizedField label="City" value={city} onChange={setCity} />
      <LocalizedField
        label="Profile"
        value={profile}
        onChange={setProfile}
        textarea
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Accreditations (one per line, e.g. JCI)">
          <Textarea
            value={accreditations}
            onChange={(e) => setAccreditations(e.target.value)}
            rows={3}
          />
        </Field>
        <Field label="Specialties (one per line)">
          <Textarea
            value={specialties}
            onChange={(e) => setSpecialties(e.target.value)}
            rows={3}
          />
        </Field>
      </div>
      <Field label="Images">
        <ImageUploader value={images} onChange={setImages} />
      </Field>
      <StatusSelect value={status} onChange={setStatus} />
    </FormShell>
  );
}

/* ------------------------------------------------------------------- Doctor */
export function DoctorForm({
  id,
  initial = {},
}: {
  id?: string;
  initial?: Init;
}) {
  const { submit, busy, error } = useCatalogSubmit(
    "doctors",
    id,
    "/admin/tourism/doctors",
  );
  const [name, setName] = useState(String(initial.name ?? ""));
  const [slug, setSlug] = useState(String(initial.slug ?? ""));
  const [status, setStatus] = useState(String(initial.status ?? "draft"));
  const [specialty, setSpecialty] = useState<Loc>(locValue(initial.specialty));
  const [location, setLocation] = useState<Loc>(locValue(initial.location));
  const [bio, setBio] = useState<Loc>(locValue(initial.bio));
  const [photo, setPhoto] = useState(String(initial.photo ?? ""));
  const [hospitalId, setHospitalId] = useState(
    String(initial.hospitalId ?? ""),
  );
  const [online, setOnline] = useState(Boolean(initial.onlineConsultation));

  return (
    <FormShell
      busy={busy}
      error={error}
      onSubmit={() =>
        submit({
          name,
          slug,
          status,
          specialty,
          location: location.en ? location : undefined,
          bio: bio.en ? bio : undefined,
          photo: photo || undefined,
          hospitalId: hospitalId || undefined,
          onlineConsultation: online,
        })
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Slug">
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
        </Field>
      </div>
      <LocalizedField
        label="Specialty"
        value={specialty}
        onChange={setSpecialty}
      />
      <LocalizedField
        label="Location"
        value={location}
        onChange={setLocation}
      />
      <LocalizedField label="Bio" value={bio} onChange={setBio} textarea />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Photo">
          <SingleImageField value={photo} onChange={setPhoto} />
        </Field>
        <Field label="Hospital ID (optional)">
          <Input
            value={hospitalId}
            onChange={(e) => setHospitalId(e.target.value)}
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ToggleRow
          label="Offers online consultation"
          checked={online}
          onChange={setOnline}
        />
        <StatusSelect value={status} onChange={setStatus} />
      </div>
    </FormShell>
  );
}

/* --------------------------------------------------------- TreatmentPackage */
const CATEGORIES = [
  "cardiac",
  "ortho",
  "neuro",
  "oncology",
  "ivf",
  "cosmetic",
  "health-check",
];

export function PackageForm({
  id,
  initial = {},
}: {
  id?: string;
  initial?: Init;
}) {
  const { submit, busy, error } = useCatalogSubmit(
    "packages",
    id,
    "/admin/tourism/packages",
  );
  const [name, setName] = useState<Loc>(locValue(initial.name));
  const [slug, setSlug] = useState(String(initial.slug ?? ""));
  const [status, setStatus] = useState(String(initial.status ?? "draft"));
  const [category, setCategory] = useState(
    String(initial.category ?? "cardiac"),
  );
  const [description, setDescription] = useState<Loc>(
    locValue(initial.description),
  );
  const [inclusions, setInclusions] = useState(
    locArrayToText(initial.inclusions),
  );
  const [hospitals, setHospitals] = useState(
    idListToText(initial.hospitalOptionIds),
  );
  const cr0 = costRangeFrom(initial);
  const [min, setMin] = useState(cr0.min);
  const [max, setMax] = useState(cr0.max);
  const [foreign, setForeign] = useState(cr0.foreign);

  return (
    <FormShell
      busy={busy}
      error={error}
      onSubmit={() =>
        submit({
          name,
          slug,
          status,
          category,
          description: description.en ? description : undefined,
          inclusions: textToLocArray(inclusions),
          hospitalOptionIds: textToIdList(hospitals),
          costRange: buildCostRange(min, max, foreign),
        })
      }
    >
      <LocalizedField label="Name" value={name} onChange={setName} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Slug">
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
        </Field>
        <Field label="Category">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c} className="capitalize">
                  {c.replace(/-/g, "")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <LocalizedField
        label="Description"
        value={description}
        onChange={setDescription}
        textarea
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Inclusions (one per line)">
          <Textarea
            value={inclusions}
            onChange={(e) => setInclusions(e.target.value)}
            rows={4}
          />
        </Field>
        <Field label="Hospital option IDs (comma-separated)">
          <Textarea
            value={hospitals}
            onChange={(e) => setHospitals(e.target.value)}
            rows={4}
          />
        </Field>
      </div>
      <CostRangeFields
        min={min}
        max={max}
        foreign={foreign}
        set={(k, v) =>
          k === "min" ? setMin(v) : k === "max" ? setMax(v) : setForeign(v)
        }
      />
      <StatusSelect value={status} onChange={setStatus} />
    </FormShell>
  );
}
