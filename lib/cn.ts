import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names, de-duplicating conflicting Tailwind utilities.
 * Backwards-compatible with the previous simple signature (strings, false,
 * null, undefined are all valid `ClassValue`s) and shared with shadcn/ui
 * primitives, which expect this exact `cn` helper.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
