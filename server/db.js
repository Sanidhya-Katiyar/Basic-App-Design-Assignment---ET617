import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");
mkdirSync(DATA_DIR, { recursive: true });

export const DB_PATH = join(DATA_DIR, "learntrace.db");

export const db = new DatabaseSync(DB_PATH);

// Apply schema (idempotent — all statements use IF NOT EXISTS).
const schema = readFileSync(join(__dirname, "schema.sql"), "utf8");
db.exec(schema);
