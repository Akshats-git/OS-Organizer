import type { Metadata } from "next";
import { connection } from "next/server";
import { OrgDirectory, parseParams } from "@/components/directory/org-directory";
import { GENERATED_AT, programCounts } from "@/lib/directory";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "Orgs" };

export default async function OrgsPage(props: PageProps<"/orgs">) {
  await connection();
  const params = parseParams(await props.searchParams);
  const counts = programCounts();
  const total = counts.reduce((n, c) => n + c.count, 0);

  return (
    <>
      <header className="mb-8 lg:mb-10">
        <h1 className="type-display text-[2.5rem] leading-none sm:text-[3rem]">Orgs</h1>
        <p className="mt-2 max-w-[64ch] text-ink-2">
          Every organization that has taken part in GSoC, LFX, Summer of Bitcoin or Outreachy, with what they build and how often they come back. Open one to see its
          year-by-year record and past projects.
        </p>
      </header>
      <OrgDirectory basePath="/orgs" params={params} programCounts={counts} />
      <p className="mt-10 border-t border-rule pt-4 text-xs text-ink-3">
        {total} program entries across the four programs; an organization in two programs is counted in both. Built from public sources on {formatDate(GENERATED_AT, { month: "long", day: "numeric", year: "numeric" })}. Re-run <code className="rounded bg-panel-2 px-1">pnpm directory:build</code> to refresh.
      </p>
    </>
  );
}
