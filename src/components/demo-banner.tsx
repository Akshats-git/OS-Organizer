"use client";

import { clearDemoData } from "@/app/actions";
import { useAction } from "./use-action";

export function DemoBanner() {
  const { run, pending } = useAction();
  return (
    <div className="mb-8 flex flex-col gap-3 rounded-[var(--radius-panel)] border border-dashed border-rule-strong px-4 py-3 text-sm sm:flex-row sm:items-center">
      <p className="flex-1 text-ink-2">
        You’re looking at demo data with made-up orgs. Clear it when you’re ready to add your own repos.
      </p>
      <button disabled={pending} onClick={() => run(() => clearDemoData())} className="btn btn-quiet self-start sm:self-auto">
        Clear demo data
      </button>
    </div>
  );
}
