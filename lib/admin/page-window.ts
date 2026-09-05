/**
 * Windowed page numbers for the list-kit pagination. Pure and framework-free
 * so it can be unit-tested; the client `Pagination` component renders it.
 */
/** 1 … 4 5 [6] 7 8 … 20 — a windowed page list with ellipses. */
export function pageWindow(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set<number>([1, pages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((n) => set.add(n));
  if (page >= pages - 2)
    [pages - 3, pages - 2, pages - 1].forEach((n) => set.add(n));
  const nums = [...set]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  for (let i = 0; i < nums.length; i++) {
    if (i > 0 && nums[i] - nums[i - 1] > 1) out.push("…");
    out.push(nums[i]);
  }
  return out;
}
