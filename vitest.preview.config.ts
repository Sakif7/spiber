import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/** Renders the PDFs so they can be looked at. Kept out of the main suite. */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["scripts/pdf-preview.test.ts"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
});
