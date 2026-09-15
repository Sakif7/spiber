import type { DocumentBody } from "@/lib/schemas/authored-document";

/**
 * Merge fields: `{{employee.name}}`-style placeholders a letter can carry.
 * The document says who it is addressed to (`mergeEmployeeId`); the values
 * are worked out at render time — on screen from the person picked in the
 * rail, on paper by the printer — and never stored in the body. No imports
 * beyond types, so the editor's dialogs use the same catalogue.
 */
export type MergeFieldKey =
  | "employee.name"
  | "employee.designation"
  | "employee.code"
  | "employee.businessEmail"
  | "employee.email"
  | "employee.phone"
  | "employee.joinedAt"
  | "employee.kind"
  | "company.name"
  | "company.phone"
  | "company.email"
  | "company.website"
  | "company.headOffice"
  | "document.number"
  | "document.title"
  | "document.date";

export const MERGE_FIELDS: {
  key: MergeFieldKey;
  label: string;
  group: "Addressed to" | "Company" | "Document";
}[] = [
  { key: "employee.name", label: "Name", group: "Addressed to" },
  { key: "employee.designation", label: "Designation", group: "Addressed to" },
  { key: "employee.code", label: "Employee code", group: "Addressed to" },
  {
    key: "employee.businessEmail",
    label: "Company email",
    group: "Addressed to",
  },
  { key: "employee.email", label: "Personal email", group: "Addressed to" },
  { key: "employee.phone", label: "Phone", group: "Addressed to" },
  { key: "employee.joinedAt", label: "Joined on", group: "Addressed to" },
  { key: "employee.kind", label: "Director / staff", group: "Addressed to" },
  { key: "company.name", label: "Company name", group: "Company" },
  { key: "company.phone", label: "Company phone", group: "Company" },
  { key: "company.email", label: "Company email", group: "Company" },
  { key: "company.website", label: "Website", group: "Company" },
  { key: "company.headOffice", label: "Head office address", group: "Company" },
  { key: "document.number", label: "Reference number", group: "Document" },
  { key: "document.title", label: "Title", group: "Document" },
  { key: "document.date", label: "Date", group: "Document" },
];

export const MERGE_FIELD_KEYS = new Set<string>(MERGE_FIELDS.map((f) => f.key));

export function mergeFieldLabel(key: string): string {
  return MERGE_FIELDS.find((f) => f.key === key)?.label ?? key;
}

/** What a resolver needs — plain data, so both sides can build it. */
export type MergeSources = {
  employee: {
    name: string;
    designation: string;
    code: string;
    businessEmail?: string | null;
    email?: string | null;
    phone?: string | null;
    joinedAt?: Date | string | null;
    kind: "director" | "staff";
  } | null;
  company: {
    name: string;
    phone: string;
    email: string;
    website: string;
    headOfficeAddress: string;
  };
  document: {
    number: string | null;
    title: string;
    date: Date | string | null;
  };
};

export type MergeValues = Partial<Record<MergeFieldKey, string>>;

const dhakaDate = (d: Date | string | null | undefined) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Dhaka",
      })
    : "";

/** Every field's text; a field without a source (no addressee yet) is absent. */
export function mergeValues(src: MergeSources): MergeValues {
  const out: MergeValues = {
    "company.name": src.company.name,
    "company.phone": src.company.phone,
    "company.email": src.company.email,
    "company.website": src.company.website,
    "company.headOffice": src.company.headOfficeAddress,
    "document.number": src.document.number ?? "",
    "document.title": src.document.title,
    "document.date": dhakaDate(src.document.date ?? new Date()),
  };
  const e = src.employee;
  if (e) {
    out["employee.name"] = e.name;
    out["employee.designation"] = e.designation;
    out["employee.code"] = e.code;
    out["employee.businessEmail"] = e.businessEmail ?? "";
    out["employee.email"] = e.email ?? "";
    out["employee.phone"] = e.phone ?? "";
    out["employee.joinedAt"] = dhakaDate(e.joinedAt);
    out["employee.kind"] = e.kind === "director" ? "Director" : "Staff";
  }
  return out;
}

type JsonNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JsonNode[];
};

function walk(node: JsonNode, visit: (n: JsonNode) => void) {
  visit(node);
  if (Array.isArray(node.content)) for (const c of node.content) walk(c, visit);
}

/** Every merge field key used in the body. */
export function mergeFieldsIn(body: DocumentBody): string[] {
  const keys = new Set<string>();
  walk(body as JsonNode, (n) => {
    if (n.type === "mergeField" && n.attrs?.field)
      keys.add(String(n.attrs.field));
  });
  return [...keys];
}

/**
 * A copy of the body with each field's `value` filled in for a render. A
 * field with no value (no addressee picked) keeps its placeholder, so the
 * printed page shows the gap rather than silently printing nothing.
 */
export function withMergeValues(
  body: DocumentBody,
  values: MergeValues,
): DocumentBody {
  if (mergeFieldsIn(body).length === 0) return stripMergeValues(body);
  const copy = JSON.parse(JSON.stringify(body)) as JsonNode;
  walk(copy, (n) => {
    if (n.type !== "mergeField") return;
    const a = (n.attrs ??= {});
    const v = values[String(a.field) as MergeFieldKey];
    a.value = v === undefined ? null : v;
  });
  return copy as DocumentBody;
}

/** The body as stored: no resolved values on any field. */
export function stripMergeValues(body: DocumentBody): DocumentBody {
  let dirty = false;
  walk(body as JsonNode, (n) => {
    if (n.type === "mergeField" && n.attrs && n.attrs.value != null)
      dirty = true;
  });
  if (!dirty) return body;
  const copy = JSON.parse(JSON.stringify(body)) as JsonNode;
  walk(copy, (n) => {
    if (n.type === "mergeField" && n.attrs) n.attrs.value = null;
  });
  return copy as DocumentBody;
}
