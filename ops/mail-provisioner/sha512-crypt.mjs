// SHA512-CRYPT (glibc crypt(3) "$6$"), the scheme docker-mailserver's own
// `setup email add` writes into postfix-accounts.cf, so accounts the sidecar
// creates and accounts an admin adds by hand are indistinguishable.
//
// Pure Node — the sidecar image has no `doveadm` or `openssl`. Verified
// against `openssl passwd -6` in tests/mail-provisioner.test.ts.
import { createHash, randomBytes } from "node:crypto";

const ITOA64 =
  "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const DEFAULT_ROUNDS = 5000;

const sha512 = (...parts) => {
  const h = createHash("sha512");
  for (const p of parts) h.update(p);
  return h.digest();
};

/** Repeat `block` until it is exactly `len` bytes long. */
function fill(block, len) {
  const out = Buffer.alloc(len);
  for (let i = 0; i < len; i += block.length) {
    block.copy(out, i, 0, Math.min(block.length, len - i));
  }
  return out;
}

function b64From24bit(b2, b1, b0, n) {
  let w = (b2 << 16) | (b1 << 8) | b0;
  let out = "";
  for (let i = 0; i < n; i++) {
    out += ITOA64[w & 0x3f];
    w >>>= 6;
  }
  return out;
}

/** A 16-character salt from the crypt alphabet. */
export function makeSalt() {
  const bytes = randomBytes(16);
  let s = "";
  for (const b of bytes) s += ITOA64[b & 0x3f];
  return s;
}

/**
 * `sha512Crypt("password", "saltsalt")` →
 * `$6$saltsalt$qFmFH.bQmm…` — the same string glibc, openssl and doveadm produce.
 */
export function sha512Crypt(
  password,
  salt = makeSalt(),
  rounds = DEFAULT_ROUNDS,
) {
  const pw = Buffer.from(password, "utf8");
  const sl = Buffer.from(salt.slice(0, 16), "utf8");

  const B = sha512(pw, sl, pw);
  const aParts = [pw, sl];
  let cnt = pw.length;
  for (; cnt > 64; cnt -= 64) aParts.push(B);
  aParts.push(B.subarray(0, cnt));
  for (cnt = pw.length; cnt > 0; cnt >>= 1) aParts.push(cnt & 1 ? B : pw);
  const A = sha512(...aParts);

  const DP = sha512(...Array.from({ length: pw.length }, () => pw));
  const P = fill(DP, pw.length);
  const DS = sha512(...Array.from({ length: 16 + A[0] }, () => sl));
  const S = fill(DS, sl.length);

  let C = A;
  for (let i = 0; i < rounds; i++) {
    const parts = [i & 1 ? P : C];
    if (i % 3) parts.push(S);
    if (i % 7) parts.push(P);
    parts.push(i & 1 ? C : P);
    C = sha512(...parts);
  }

  const order = [
    [0, 21, 42],
    [22, 43, 1],
    [44, 2, 23],
    [3, 24, 45],
    [25, 46, 4],
    [47, 5, 26],
    [6, 27, 48],
    [28, 49, 7],
    [50, 8, 29],
    [9, 30, 51],
    [31, 52, 10],
    [53, 11, 32],
    [12, 33, 54],
    [34, 55, 13],
    [56, 14, 35],
    [15, 36, 57],
    [37, 58, 16],
    [59, 17, 38],
    [18, 39, 60],
    [40, 61, 19],
    [62, 20, 41],
  ];
  let enc = "";
  for (const [x, y, z] of order) enc += b64From24bit(C[x], C[y], C[z], 4);
  enc += b64From24bit(0, 0, C[63], 2);

  const prefix = rounds === DEFAULT_ROUNDS ? "$6$" : `$6$rounds=${rounds}$`;
  return `${prefix}${sl.toString("utf8")}$${enc}`;
}
