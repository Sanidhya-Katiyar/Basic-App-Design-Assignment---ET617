import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

// Password hashing with Node's built-in scrypt — no native module to compile,
// works out of the box. Format stored: "scrypt$<saltHex>$<hashHex>".

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password, stored) {
  const parts = String(stored).split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function newToken() {
  return randomBytes(24).toString("hex");
}
