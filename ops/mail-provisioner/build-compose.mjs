// Emits the Compose service block for the sidecar with the three source files
// inlined as `configs` (Compose ≥ 2.23 supports `content:`), so the Coolify
// "mail" stack needs no image registry and no bind mount from a git checkout.
//
//   node ops/mail-provisioner/build-compose.mjs > ops/mail-provisioner/compose.snippet.yml
//
// Paste the `mail-provisioner` service + the `configs` block into the mail
// service's docker-compose.yml in Coolify (see README.md).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const files = ["server.mjs", "accounts.mjs", "sha512-crypt.mjs"];
const indent = (text, n) =>
  text
    .split("\n")
    .map((l) => (l === "" ? "" : " ".repeat(n) + l))
    .join("\n");

let out = `services:
  mail-provisioner:
    image: 'node:22-alpine'
    restart: unless-stopped
    command: ['node', '/app/server.mjs']
    environment:
      PROVISIONER_SECRET: '\${MAIL_PROVISIONER_SECRET}'
      DMS_CONFIG_DIR: /tmp/docker-mailserver
      MAIL_DOMAIN: spibermed.com
      PORT: '8025'
    volumes:
      - 'acoq4wmmjj3bfn3pu50s25h6_dms-config:/tmp/docker-mailserver'
    configs:
${files.map((f) => `      - source: provisioner_${f.replace(/[^a-z0-9]/gi, "_")}\n        target: /app/${f}`).join("\n")}
    networks:
      acoq4wmmjj3bfn3pu50s25h6: null
    healthcheck:
      test: ['CMD', 'wget', '-qO-', 'http://127.0.0.1:8025/health']
      interval: 30s
      timeout: 5s
      retries: 3

configs:
`;
for (const f of files) {
  out += `  provisioner_${f.replace(/[^a-z0-9]/gi, "_")}:\n    content: |\n${indent(readFileSync(path.join(here, f), "utf8"), 6)}\n`;
}
process.stdout.write(out);
