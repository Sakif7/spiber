/**
 * Magic-byte sniffing for uploads.
 *
 * The multipart `file.type` is whatever the client typed — a renamed
 * executable can claim `application/pdf` and pass any allowlist that trusts it.
 * The careers résumé route already sniffed its uploads; this generalises that
 * check so every upload route can confirm the bytes match the claim before the
 * file is stored and later served back with the declared Content-Type.
 *
 * Note the deliberate limits: OOXML files (docx/xlsx/pptx) are ZIP containers,
 * so the sniffer can only tell "this is a ZIP", not which flavour. That is
 * enough for the threat we care about (arbitrary binaries), and `mimeMatchesBytes`
 * treats the whole ZIP family as interchangeable rather than pretending to
 * more precision than the signature gives.
 */

/** Broad content families a signature can identify. */
export type SniffedKind =
  | "pdf"
  | "png"
  | "jpeg"
  | "gif"
  | "webp"
  | "avif"
  | "zip"
  | "ole"
  | "text"
  | "unknown";

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

/**
 * Identify a buffer by its leading bytes. Only the head is needed; callers may
 * pass the whole file.
 */
export function sniffKind(buf: Buffer): SniffedKind {
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46])) return "pdf"; // %PDF
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "png";
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(buf, [0x47, 0x49, 0x46, 0x38])) return "gif"; // GIF8
  // RIFF....WEBP
  if (
    startsWith(buf, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)
  )
    return "webp";
  // ....ftyp<avif|avis> — ISO-BMFF brand at offset 8.
  if (
    startsWith(buf, [0x66, 0x74, 0x79, 0x70], 4) &&
    (startsWith(buf, [0x61, 0x76, 0x69, 0x66], 8) ||
      startsWith(buf, [0x61, 0x76, 0x69, 0x73], 8))
  )
    return "avif";
  if (startsWith(buf, [0x50, 0x4b])) return "zip"; // PK — zip, docx, xlsx, pptx
  if (startsWith(buf, [0xd0, 0xcf, 0x11, 0xe0])) return "ole"; // legacy doc/xls/ppt
  if (isTextLike(buf)) return "text";
  return "unknown";
}

/**
 * Heuristic for text/csv/plain: valid UTF-8-ish with no NUL and few control
 * characters in the first 4 KB. Text has no signature, so this is the best a
 * sniffer can do; it exists to reject binaries claiming to be text.
 */
export function isTextLike(buf: Buffer): boolean {
  const head = buf.subarray(0, 4096);
  if (head.length === 0) return true;
  let suspicious = 0;
  for (const byte of head) {
    if (byte === 0x00) return false;
    // Allow tab, LF, CR; count other C0 controls as binary evidence.
    if (byte < 0x09 || (byte > 0x0d && byte < 0x20)) suspicious += 1;
  }
  return suspicious / head.length < 0.05;
}

/** The kinds each accepted MIME type may legitimately have on disk. */
const MIME_KINDS: Record<string, SniffedKind[]> = {
  "application/pdf": ["pdf"],
  "image/png": ["png"],
  "image/jpeg": ["jpeg"],
  "image/gif": ["gif"],
  "image/webp": ["webp"],
  "image/avif": ["avif"],
  "application/zip": ["zip"],
  "application/x-zip-compressed": ["zip"],
  "application/msword": ["ole", "zip"],
  "application/vnd.ms-excel": ["ole", "zip"],
  "application/vnd.ms-powerpoint": ["ole", "zip"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    "zip",
  ],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["zip"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    "zip",
  ],
  "text/csv": ["text"],
  "text/plain": ["text"],
};

/**
 * Does the file's content match the MIME type it claims? Unknown MIME types are
 * rejected — callers pass a type that already passed their allowlist, so an
 * entry missing here means the allowlist and this table have drifted apart.
 */
export function mimeMatchesBytes(mime: string, buf: Buffer): boolean {
  const allowed = MIME_KINDS[mime];
  if (!allowed) return false;
  return allowed.includes(sniffKind(buf));
}

/** Filename extensions each MIME type may carry (lowercase, no dot). */
const MIME_EXTS: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/gif": ["gif"],
  "image/webp": ["webp"],
  "image/avif": ["avif"],
  "application/zip": ["zip"],
  "application/x-zip-compressed": ["zip"],
  "application/msword": ["doc"],
  "application/vnd.ms-excel": ["xls"],
  "application/vnd.ms-powerpoint": ["ppt"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    "docx",
  ],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    "pptx",
  ],
  "text/csv": ["csv"],
  "text/plain": ["txt", "log", "md"],
};

/** The canonical extension to store a file under, given its MIME type. */
export function extensionFor(mime: string): string | null {
  return MIME_EXTS[mime]?.[0] ?? null;
}

/**
 * Is `filename`'s extension consistent with the claimed MIME type? A file with
 * no extension passes (the storage key derives its own), so this only rejects
 * an explicit mismatch such as `payload.exe` sent as `application/pdf`.
 */
export function extensionMatches(mime: string, filename: string): boolean {
  const allowed = MIME_EXTS[mime];
  if (!allowed) return false;
  const dot = filename.lastIndexOf(".");
  if (dot < 0 || dot === filename.length - 1) return true;
  const ext = filename.slice(dot + 1).toLowerCase();
  return allowed.includes(ext);
}
