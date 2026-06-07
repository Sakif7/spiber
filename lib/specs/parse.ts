/**
 * Parse a pasted block of "Key: Value" lines into complete spec pairs.
 *
 * Each line is split on the FIRST delimiter it contains — a colon, tab, equals
 * sign, or a spaced dash ("Key - Value"). Whichever appears leftmost wins, so
 * values may freely contain the other delimiters (e.g. "Time: 10:30:00"). Lines
 * that don't yield BOTH a non-empty key and value (blank lines, headers like
 * "Specifications:") are dropped, since product specs require both.
 *
 *   parseSpecLines("Model: 1\nColor: Red\nSize: Large")
 *   // → [{key:"Model",value:"1"}, {key:"Color",value:"Red"}, {key:"Size",value:"Large"}]
 */
const SPLIT_RE = /^(.*?)\s*(?::|\t|=|\s[-–—]\s)\s*(.+)$/;

export type SpecPair = { key: string; value: string };

export function parseSpecLines(text: string): SpecPair[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(SPLIT_RE);
      if (!m) return null;
      const key = m[1].trim();
      const value = m[2].trim();
      if (!key || !value) return null;
      return { key, value };
    })
    .filter((p): p is SpecPair => p !== null);
}

/**
 * Decide whether text pasted INTO a single spec field should be expanded into
 * many specs. Returns the parsed pairs only when the blob is multi-line AND
 * every non-empty line is a clean "Key: Value" pair — so ordinary single-field
 * pastes (a single line, or messy prose) are never hijacked. Returns null when
 * the caller should let the normal paste happen.
 */
export function bulkSpecPasteFromText(text: string): SpecPair[] | null {
  if (!/[\r\n]/.test(text)) return null;
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const pairs = parseSpecLines(text);
  if (pairs.length === 0 || pairs.length !== lines.length) return null;
  return pairs;
}
