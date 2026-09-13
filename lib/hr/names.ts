/**
 * The name to greet someone by: the first word that is not an honorific.
 * "Md. Jahidul Islam" → "Jahidul", "Dr Farhana Rahman" → "Farhana".
 */
const HONORIFICS = new Set([
  "md",
  "md.",
  "mr",
  "mr.",
  "mrs",
  "mrs.",
  "ms",
  "ms.",
  "dr",
  "dr.",
  "prof",
  "prof.",
  "eng",
  "eng.",
]);

export function givenName(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  const first = words.find((w) => !HONORIFICS.has(w.toLowerCase()));
  return first ?? words[0] ?? fullName;
}
