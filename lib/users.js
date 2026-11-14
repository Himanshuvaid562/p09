import crypto from "crypto";
import { findUser } from "./db";

// Passwords are stored as "salt:hash" (scrypt). Plain-text passwords are never saved.
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return salt + ":" + hash;
}

export function checkPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;

  const [salt, hash] = stored.split(":");
  try {
    const test = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), test);
  } catch {
    return false;
  }
}

// the courses a student is enrolled in
export async function getCourses(username) {
  const user = await findUser(username);
  return (user && user.courses) || [];
}
