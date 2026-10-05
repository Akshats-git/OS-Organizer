"use client";

import { Check, Copy, Plus, X } from "lucide-react";
import { useState } from "react";
import { addProgramEvent, confirmProgramEvent, deleteProgramEvent } from "@/app/actions";
import { useToast } from "./toast";
import { useAction } from "./use-action";

export function EventControls({ id, estimated }: { id: number; estimated: boolean }) {
  const { run, pending } = useAction();
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      {estimated && (
        <button disabled={pending} onClick={() => run(() => confirmProgramEvent(id))} className="btn btn-ghost px-2 text-xs" title="The official date matches">
          <Check className="size-3.5" /> Confirm
        </button>
      )}
      <button disabled={pending} onClick={() => run(() => deleteProgramEvent(id))} className="btn btn-ghost px-1.5" aria-label="Remove date">
        <X className="size-3.5" />
      </button>
    </span>
  );
}

export function AddEvent({ programId }: { programId: string }) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction();
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="btn btn-ghost text-xs">
        <Plus className="size-3.5" /> Add a date
      </button>
    );
  return (
    <form
      className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(
          () => addProgramEvent({ programId, title: String(f.get("title")), date: String(f.get("date")), kind: f.get("kind") as "deadline" }),
          () => setOpen(false),
        );
      }}
    >
      <input name="title" placeholder="Proposal deadline" required className="field" aria-label="What happens" />
      <input name="date" type="date" required className="field" aria-label="Date" />
      <select name="kind" defaultValue="deadline" className="field" aria-label="Kind">
        <option value="open">Opens</option>
        <option value="deadline">Deadline</option>
        <option value="announce">Announcement</option>
        <option value="result">Results</option>
        <option value="coding">Coding starts</option>
      </select>
      <span className="flex gap-2">
        <button disabled={pending} className="btn btn-primary">Add</button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">Cancel</button>
      </span>
    </form>
  );
}

export function CopyField({ value, label }: { value: string; label: string }) {
  const toast = useToast();
  return (
    <div className="flex items-center gap-2">
      <input readOnly value={value} className="field min-w-0 flex-1 text-ink-2" aria-label={label} onFocus={(e) => e.currentTarget.select()} />
      <button
        className="btn btn-quiet"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            toast("Copied.");
          } catch {
            toast("Couldn’t reach the clipboard. Select the text and copy it.", "error");
          }
        }}
      >
        <Copy className="size-3.5" /> Copy
      </button>
    </div>
  );
}
