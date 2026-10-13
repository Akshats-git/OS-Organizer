import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./data/os-organizer.db";

const globalForDb = globalThis as unknown as { client?: ReturnType<typeof createClient> };

// Reuse one client across hot reloads in dev.
const client = globalForDb.client ?? createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
if (process.env.NODE_ENV !== "production") globalForDb.client = client;

export const db = drizzle(client, { schema });
export { schema };
