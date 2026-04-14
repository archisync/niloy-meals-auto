import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { getServerEnv } from "@/lib/env";

export const SESSION_COOKIE = "meals_session";

function hash(value: string) {
  const { AUTH_KEY } = getServerEnv();
  return createHmac("sha256", AUTH_KEY).update(value).digest("hex");
}

export function createSessionValue() {
  const nonce = randomBytes(24).toString("hex");
  return `${nonce}.${hash(nonce)}`;
}

export function isValidSession(value?: string) {
  if (!value) {
    return false;
  }

  const [nonce, signature] = value.split(".");

  if (!nonce || !signature) {
    return false;
  }

  const expected = Buffer.from(hash(nonce));
  const actual = Buffer.from(signature);

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}
