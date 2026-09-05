/**
 * Raw upload API error codes → human messages, shared by every admin uploader.
 *
 * It lives in its own module so `image-uploader` and `upload-fields` can both
 * use it without importing each other (they render each other's controls, so a
 * shared constant in either one would create an import cycle).
 */
export function uploadErrorMessage(code: string | undefined): string {
  switch (code) {
    case "forbidden":
    case "unauthorized":
      return "You don't have permission to upload here.";
    case "too_large":
      return "That file is too large.";
    case "bad_type":
      return "That file type isn't supported — use JPG, PNG or WebP.";
    case "rate_limited":
      return "Too many uploads — wait a moment and try again.";
    default:
      return "Upload failed. Please try again.";
  }
}
