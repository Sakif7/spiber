"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/admin/ui/select-field";
import {
  EditorForm,
  FormField,
  FormSection,
  SaveBar,
} from "@/components/admin/ui/form-shell";
import { formatApiError } from "@/lib/http/form-error";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL,
  type DocumentLanguage,
  type DocumentType,
} from "@/lib/documents/types";

const LANGUAGES: { value: DocumentLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "bn", label: "Bangla" },
  { value: "both", label: "English and Bangla" },
];

/** Kind, title, language — then straight into the editor. */
export function NewDocumentForm() {
  const router = useRouter();
  const [type, setType] = useState<DocumentType>("notice");
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState<DocumentLanguage>("en");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/company/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, title, language }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(formatApiError(json, "Could not create the document."));
        return;
      }
      toast.success("Draft created.");
      router.push(`/admin/company/documents/${json.data.id}/edit`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditorForm>
      <FormSection title="Document">
        <FormField label="Kind" required>
          <SelectField
            value={type}
            onChange={(v) => setType(v as DocumentType)}
            options={DOCUMENT_TYPES.map((t) => ({
              value: t,
              label: DOCUMENT_TYPE_LABEL[t],
            }))}
          />
        </FormField>
        <FormField
          label="Title"
          required
          hint="Shown in the list and printed in the footer; the number is assigned when the document is sent."
        >
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Office closure — Victory Day"
            maxLength={200}
            autoFocus
          />
        </FormField>
        <FormField
          label="Language"
          hint="Sets the starting font; you can mix both in the text."
        >
          <SelectField
            value={language}
            onChange={(v) => setLanguage(v as DocumentLanguage)}
            options={LANGUAGES}
          />
        </FormField>
      </FormSection>
      <SaveBar
        saving={saving}
        error={error}
        onSave={submit}
        saveLabel="Create and open"
        disabled={!title.trim()}
      />
    </EditorForm>
  );
}
