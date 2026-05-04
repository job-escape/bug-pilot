import { readFileSync } from "fs";
import { join } from "path";
import postgres from "postgres";

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) throw new Error("Missing DATABASE_URL");

const sql = postgres(DATABASE_URL, { ssl: "require", prepare: false, connect_timeout: 30 });

// Base schema (idempotent — all CREATE IF NOT EXISTS)
const schema = readFileSync(join(import.meta.dir, "../src/db/schema.sql"), "utf8");
await sql.unsafe(schema);

// Additive migrations for databases created before current schema
const migrations = [
  `ALTER TABLE repos ADD COLUMN IF NOT EXISTS fix_model TEXT`,
  `ALTER TABLE repos ADD COLUMN IF NOT EXISTS parser_model TEXT`,
  `ALTER TABLE threads ADD COLUMN IF NOT EXISTS repo TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE threads ADD COLUMN IF NOT EXISTS user_context TEXT`,
  `ALTER TABLE bugs ADD COLUMN IF NOT EXISTS user_note TEXT`,
  `ALTER TABLE bugs ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}'`,
  // Migrate existing single image_url into image_urls array
  `UPDATE bugs SET image_urls = ARRAY[image_url] WHERE image_url IS NOT NULL AND (image_urls IS NULL OR image_urls = '{}')`,
];

for (const m of migrations) {
  await sql.unsafe(m);
}

await sql.end();
console.log("✅ Database migrated successfully");
