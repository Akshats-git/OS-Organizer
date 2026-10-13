/**
 * Copies every row from the local database into a hosted one (Turso).
 *
 *   TARGET_DATABASE_URL=libsql://… TARGET_DATABASE_AUTH_TOKEN=… pnpm db:push-data
 *
 * Migrates the target first, then refuses to touch it if it already has rows,
 * unless you pass --replace (which wipes the target's rows before copying).
 */
import "dotenv/config";
import { createClient, type Client, type InStatement } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const sourceUrl = process.env.DATABASE_URL ?? "file:./data/os-organizer.db";
const targetUrl = process.env.TARGET_DATABASE_URL;
const replace = process.argv.includes("--replace");

if (!targetUrl) {
  console.error("Set TARGET_DATABASE_URL (and TARGET_DATABASE_AUTH_TOKEN) to the hosted database.");
  process.exit(1);
}
if (targetUrl === sourceUrl) {
  console.error("TARGET_DATABASE_URL is the same as DATABASE_URL. Point it at the hosted database.");
  process.exit(1);
}

const source = createClient({ url: sourceUrl, authToken: process.env.DATABASE_AUTH_TOKEN });
const target = createClient({ url: targetUrl, authToken: process.env.TARGET_DATABASE_AUTH_TOKEN });

/** App tables, parents before children, so foreign keys hold while inserting. */
async function tablesInOrder(db: Client) {
  const names = (await db.execute("select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name != '__drizzle_migrations'")).rows.map((r) => String(r.name));
  const parents = new Map<string, string[]>();
  for (const name of names) {
    const fks = await db.execute(`pragma foreign_key_list("${name}")`);
    parents.set(name, fks.rows.map((r) => String(r.table)).filter((t) => t !== name));
  }
  const ordered: string[] = [];
  const visit = (name: string) => {
    if (ordered.includes(name)) return;
    for (const p of parents.get(name) ?? []) visit(p);
    ordered.push(name);
  };
  names.sort().forEach(visit);
  return ordered;
}

async function main() {
  console.log("Migrating the target…");
  await migrate(drizzle(target), { migrationsFolder: "./drizzle" });

  const tables = await tablesInOrder(source);
  const targetTables = new Set(await tablesInOrder(target));
  const missing = tables.filter((t) => !targetTables.has(t));
  if (missing.length) throw new Error(`Target is missing tables: ${missing.join(", ")}. Run pnpm db:migrate locally first.`);

  let existing = 0;
  for (const t of tables) existing += Number((await target.execute(`select count(*) as n from "${t}"`)).rows[0].n);
  if (existing > 0 && !replace) {
    throw new Error(`The target already has ${existing} rows. Re-run with --replace to wipe them and copy again.`);
  }

  const statements: InStatement[] = [];
  if (replace) for (const t of [...tables].reverse()) statements.push(`delete from "${t}"`);

  const counts: Record<string, number> = {};
  for (const t of tables) {
    const { columns, rows } = await source.execute(`select * from "${t}"`);
    counts[t] = rows.length;
    const cols = columns.map((c) => `"${c}"`).join(", ");
    const marks = columns.map(() => "?").join(", ");
    for (const row of rows) {
      statements.push({ sql: `insert into "${t}" (${cols}) values (${marks})`, args: columns.map((c) => row[c]) });
    }
  }

  // One transaction: either everything lands or nothing does.
  await target.batch(statements, "write");

  for (const t of tables) {
    const n = Number((await target.execute(`select count(*) as n from "${t}"`)).rows[0].n);
    const flag = n === counts[t] ? "" : `  ← expected ${counts[t]}`;
    console.log(`  ${t.padEnd(16)} ${n}${flag}`);
  }
  console.log("Done. Your data is in the hosted database.");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => {
    source.close();
    target.close();
  });
