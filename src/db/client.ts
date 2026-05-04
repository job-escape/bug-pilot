import postgres from "postgres";

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) throw new Error("Missing DATABASE_URL");

export const sql = postgres(DATABASE_URL, { prepare: false });
