import { Low } from "lowdb";
import { JSONFile, JSONFilePreset } from "lowdb/node";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { freshSeed } from "./seed.js";
import { hashPassword } from "./passwords.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const dbPath = path.resolve(here, "../../data/db.json");

export async function createDb(file = dbPath, options = {}) {
  await mkdir(path.dirname(file), { recursive: true });
  const db = options.persist
    ? new Low(new JSONFile(file), freshSeed())
    : await JSONFilePreset(file, freshSeed());
  if (options.persist) await db.read();
  if (!db.data.users?.length) {
    db.data = freshSeed();
    await db.write();
  } else {
    let migrated = false;
    db.data.users = db.data.users.map((user) => {
      if (!user || typeof user !== "object" || typeof user.password !== "string") return user;

      migrated = true;
      const { password, ...withoutPlaintext } = user;
      return withoutPlaintext.passwordHash
        ? withoutPlaintext
        : { ...withoutPlaintext, passwordHash: hashPassword(password) };
    });
    if (migrated) await db.write();
  }
  return db;
}
