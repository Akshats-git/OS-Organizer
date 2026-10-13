import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AddRepoButton } from "@/components/add-repo-dialog";
import { LineMap } from "@/components/line-map";
import { LoopSheet } from "@/components/loop-sheet";
import { ProgramFilter, ProgramPlate } from "@/components/program-sign";
import { getNetwork } from "@/lib/data";
import { NO_PROGRAM_LABEL } from "@/lib/programs";

export const metadata: Metadata = { title: "Lines" };

export default async function LinesPage(props: PageProps<"/lines">) {
  await connection();
  const { lines, groups, programs, loopEvents } = await getNetwork();
  const selected = (await props.searchParams).program;
  const active = typeof selected === "string" && groups.some((g) => g.key === selected) ? selected : null;
  const shown = active ? groups.filter((g) => g.key === active) : groups;
  const inMotion = (ls: typeof lines) => ls.reduce((n, l) => n + l.active.length, 0);

  return (
    <>
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="type-display text-[2.5rem] leading-none sm:text-[3rem]">Lines</h1>
          <p className="mt-2 max-w-[62ch] text-ink-2">
            Each repo is a line and each contribution is a train moving through it. Lines are grouped by the program you are aiming them at.{" "}
            {lines.length > 0 &&
              `${inMotion(lines)} loop${inMotion(lines) === 1 ? "" : "s"} in motion across ${lines.length} repo${lines.length === 1 ? "" : "s"}.`}
          </p>
        </div>
        <Suspense>
          <AddRepoButton programs={programs.map((p) => ({ id: p.id, name: p.name }))} />
        </Suspense>
      </header>

      {lines.length === 0 ? (
        <div className="panel px-6 py-10 text-center">
          <p className="type-display text-2xl">No lines yet</p>
          <p className="mx-auto mt-2 max-w-[48ch] text-ink-2">
            Add the repos you want maintainers to know you in, each filed under the program you are targeting. Five is a good number to keep moving at once.
          </p>
        </div>
      ) : (
        <>
          <ProgramFilter
            path="/lines"
            active={active}
            total={lines.length}
            counts={groups.map((g) => ({ key: g.key, label: g.label, count: g.items.length }))}
          />

          <div className="space-y-10">
            {shown.map((group) => (
              <section key={group.key} aria-labelledby={`zone-${group.key}`}>
                <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <ProgramPlate label={group.label} />
                  <h2 id={`zone-${group.key}`} className="type-display text-xl">
                    {group.program?.name ?? NO_PROGRAM_LABEL}
                  </h2>
                  <span className="text-sm text-ink-3">
                    {group.items.length} repo{group.items.length === 1 ? "" : "s"}, {inMotion(group.items)} in motion
                  </span>
                  {group.program ? (
                    <Link href={`/programs#program-${group.program.id}`} className="link ml-auto text-xs text-ink-2">
                      Key dates
                    </Link>
                  ) : (
                    <span className="ml-auto text-xs text-ink-3">Set a program on each repo’s page</span>
                  )}
                </div>
                <div className="md:panel md:px-6 md:pb-2 md:pt-5">
                  <Suspense>
                    <LineMap lines={group.items} />
                  </Suspense>
                </div>
              </section>
            ))}
          </div>

          <p className="mt-4 text-sm text-ink-3">
            Grey dots are stations a repo skips. Select a train to move it along or see its history.
            {active && (
              <>
                {" "}
                <Link href="/lines" className="link">
                  Show every program
                </Link>
                .
              </>
            )}
          </p>
        </>
      )}

      <Suspense>
        <LoopSheet loops={lines.flatMap((l) => l.active)} repos={lines.map((l) => l.repo)} events={loopEvents} />
      </Suspense>
    </>
  );
}
