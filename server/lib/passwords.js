import crypto from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  if (typeof password !== "string" || typeof storedHash !== "string") return false;

  const [salt, hashHex, extra] = storedHash.split(":");
  if (!salt || extra !== undefined || !/^[0-9a-f]+$/i.test(hashHex ?? "")) return false;

  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = crypto.scryptSync(password, salt, KEY_LENGTH);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
