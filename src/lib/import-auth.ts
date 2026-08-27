import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const IMPORT_AUTH_COOKIE = "budget_import_authorized";

const IMPORT_PASSWORD_HASH = "3a376f9817ecf5ef9c08f82f52c9a04a95061bc594b4ca8eea095c3ecde0995c";
const IMPORT_SESSION_TOKEN = "ca35abf68b1a104b5d27d6dbc743a45caafde848c8a983189bfc23b64329112d";

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyImportPassword(password: string) {
  return safeEqual(sha256(password), IMPORT_PASSWORD_HASH);
}

export function importSessionToken() {
  return IMPORT_SESSION_TOKEN;
}

export function isImportAuthorized(request: NextRequest) {
  return safeEqual(
    request.cookies.get(IMPORT_AUTH_COOKIE)?.value ?? "",
    IMPORT_SESSION_TOKEN,
  );
}
