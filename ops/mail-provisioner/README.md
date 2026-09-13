# mail-provisioner

The one way the app creates, disables and re-keys mailboxes on the company
mail server (docker-mailserver on the Spiber VPS, Coolify service `mail`).

- Pure Node 22, no dependencies (`server.mjs`, `accounts.mjs`,
  `sha512-crypt.mjs`). Unit-tested from the app repo
  (`tests/mail-provisioner.test.ts`), including the hash against
  `openssl passwd -6`.
- Mounts **only** the `dms-config` volume and writes the same two flat files
  `setup email add` writes (`postfix-accounts.cf`, `dovecot-quotas.cf`).
  DMS's changedetector reloads Postfix/Dovecot within seconds.
- One bearer secret (`PROVISIONER_SECRET`, 32+ chars) — the app holds it as
  `MAIL_PROVISIONER_SECRET`. Not exposed through Traefik; the app reaches it
  on the mail stack's docker network as `http://mail-provisioner:8025`.

## API

| Method | Path                          | Body                  | Result           |
| ------ | ----------------------------- | --------------------- | ---------------- |
| GET    | `/health`                     |                       | `{ok:true}`      |
| GET    | `/accounts`                   |                       | `{accounts:[…]}` |
| GET    | `/accounts/:address`          |                       | 200 / 404        |
| PUT    | `/accounts/:address`          | `{password, quota?}`  | 201 / 409 exists |
| PUT    | `/accounts/:address/password` | `{password}`          | 204 / 404        |
| PUT    | `/accounts/:address/quota`    | `{quota}` e.g. `"5G"` | 204 / 404        |
| DELETE | `/accounts/:address`          |                       | 204 / 404        |

Passwords: 12–128 chars, no `|` or newline. Addresses must be on
`MAIL_DOMAIN` when that env is set.

## Deploying (Coolify → mail service → Compose file)

1. `node ops/mail-provisioner/build-compose.mjs > ops/mail-provisioner/compose.snippet.yml`
2. (Alternative, used on 2026-09-13.) Copy `*.mjs` to `/data/coolify/services/<uuid>/provisioner/` on the VPS and paste `coolify-mail-compose.yml` (bind-mounts that folder) into Coolify — no inline configs needed.
   2b. Add the `mail-provisioner` service and the `configs:` block from the
   snippet to the mail service's compose file; add `MAIL_PROVISIONER_SECRET`
   to that service's environment in Coolify.
3. Redeploy the mail service. `docker logs mail-provisioner-…` should print
   `mail-provisioner listening on :8025`.
4. Attach the app to the mail network (Coolify → app → "Connect to
   predefined network" `acoq4wmmjj3bfn3pu50s25h6`) and set on the app:
   `MAIL_PROVISIONER=http`, `MAIL_PROVISIONER_URL=http://mail-provisioner:8025`,
   `MAIL_PROVISIONER_SECRET=<same secret>`.
