import type { Program } from "@/db/schema";

/**
 * Short signage labels. Full program names are too long for a zone sign or a
 * filter chip, so every grouped view asks for the short one.
 */
const SHORT_NAMES: Record<string, string> = {
  gsoc: "GSoC",
  lfx: "LFX",
  sob: "Summer of Bitcoin",
  outreachy: "Outreachy",
  esoc: "ESoC",
};

export const programShortName = (p: { id: string; name: string }) => SHORT_NAMES[p.id] ?? p.name;

/** Group key and label for repos that aren't aimed at a program yet. */
export const NO_PROGRAM = "none";
export const NO_PROGRAM_LABEL = "No program yet";

export type ProgramGroup<T> = {
  /** Program id, or NO_PROGRAM for the leftover group. */
  key: string;
  program: Program | null;
  label: string;
  items: T[];
};

/**
 * Split repos into one group per program, busiest first, with the repos that
 * have no program last. Programs you own no repos in are left out.
 */
export function groupByProgram<T extends { repo: { programId: string | null } }>(
  items: T[],
  programs: Program[],
): ProgramGroup<T>[] {
  const byId = new Map(programs.map((p) => [p.id, p]));
  const groups = new Map<string, ProgramGroup<T>>();

  for (const item of items) {
    const program = (item.repo.programId && byId.get(item.repo.programId)) || null;
    const key = program?.id ?? NO_PROGRAM;
    let group = groups.get(key);
    if (!group) {
      group = { key, program, label: program ? programShortName(program) : NO_PROGRAM_LABEL, items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }

  return [...groups.values()].sort((a, b) => {
    if (a.key === NO_PROGRAM) return 1;
    if (b.key === NO_PROGRAM) return -1;
    return b.items.length - a.items.length || a.label.localeCompare(b.label);
  });
}
