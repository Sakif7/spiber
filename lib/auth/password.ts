import bcrypt from "bcryptjs";

// Pure-JS bcrypt (bcryptjs) avoids native-module build issues in the Coolify
// standalone Docker image. 12 rounds is a sensible default for 2026.
const ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
