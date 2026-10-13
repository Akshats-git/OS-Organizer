import "dotenv/config";
import { mkdirSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const url = process.env.DATABASE_URL ?? "file:./data/os-organizer.db";
if (url.startsWith("file:")) mkdirSync("data", { recursive: true });

const db = drizzle(createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN }));
migrate(db, { migrationsFolder: "./drizzle" })
  .then(() => console.log("Database is up to date."))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
