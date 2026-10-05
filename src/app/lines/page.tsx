import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AddRepoButton } from "@/components/add-repo-dialog";
import { LineMap } from "@/components/line-map";
import { LoopSheet } from "@/components/loop-sheet";
import { getNetwork, getPrograms } from "@/lib/data";

export const metadata: Metadata = { title: "Lines" };

export default async function LinesPage() {
  await connection();
  const [{ lines, loopEvents }, programs] = await Promise.all([getNetwork(), getPrograms()]);
  const active = lines.reduce((n, l) => n + l.active.length, 0);

  return (
    <>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between lg:mb-10">
        <div>
          <h1 className="type-display text-[2.5rem] leading-none sm:text-[3rem]">Lines</h1>
          <p className="mt-2 max-w-[62ch] text-ink-2">
            Each repo is a line and each contribution is a train moving through it.{" "}
            {lines.length > 0 && `${active} loop${active === 1 ? "" : "s"} in motion across ${lines.length} repo${lines.length === 1 ? "" : "s"}.`}
          </p>
        </div>
        <Suspense>
          <AddRepoButton programs={programs.map((p) => ({ id: p.id, name: p.name }))} />
        </Suspense>
      </header>

      {lines.length === 0 ? (
        <div className="panel px-6 py-10 text-center">
          <p className="type-display text-2xl">No lines yet</p>
          <p className="mx-auto mt-2 max-w-[48ch] text-ink-2">Add the repos you want maintainers to know you in. Five is a good number to keep moving at once.</p>
        </div>
      ) : (
        <div className="md:panel md:px-6 md:pb-2 md:pt-5">
          <Suspense>
            <LineMap lines={lines} />
          </Suspense>
        </div>
      )}

      {lines.length > 0 && (
        <p className="mt-4 text-sm text-ink-3">
          Grey dots are stations a repo skips. Select a train to move it along or see its history.
        </p>
      )}

      <Suspense>
        <LoopSheet loops={lines.flatMap((l) => l.active)} repos={lines.map((l) => l.repo)} events={loopEvents} />
      </Suspense>
    </>
  );
}
