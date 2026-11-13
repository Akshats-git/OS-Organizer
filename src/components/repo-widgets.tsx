"use client";

import clsx from "clsx";
import { ClipboardCopy, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { addContact, archiveRepo, logActivity, setFollowUp, startLoop, touchContact, updateRepo } from "@/app/actions";
import type { Loop, Repo, Workflow } from "@/db/schema";
import { loopStatus } from "@/lib/loop-status";
import { WORKFLOW_LABELS } from "@/lib/stages";
import { MiniLine } from "./mini-line";
import { useToast } from "./toast";
import { useAction } from "./use-action";

const TONE_TEXT = { urgent: "text-urgent", soon: "text-soon", calm: "text-ink-3", done: "text-ok" } as const;

export function StartLoopForm({ repoId, workflow }: { repoId: number; workflow: Workflow }) {
  const { run, pending } = useAction();
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const placeholder = workflow === "ask-first" ? "Discord message link (optional)" : workflow === "issue-first" ? "Issue link (optional)" : "PR link (optional)";
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => startLoop({ repoId, title, link }), () => (setTitle(""), setLink("")));
      }}
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What do you want to work on?" className="field sm:flex-[1.4]" aria-label="Loop name" />
      <input value={link} onChange={(e) => setLink(e.target.value)} placeholder={placeholder} className="field sm:flex-1" aria-label={placeholder} />
      <button type="submit" disabled={pending || !title.trim()} className="btn btn-primary">
        Start loop
      </button>
    </form>
  );
}

export function LoopRows({ loops, repo, ages }: { loops: Loop[]; repo: Repo; ages: Record<number, string> }) {
  const pathname = usePathname();
  if (!loops.length) return <p className="py-4 text-sm text-ink-3">Nothing in motion. Start a loop above when you’ve found something to work on.</p>;
  return (
    <ul className="divide-y divide-rule">
      {loops.map((l) => {
        const s = loopStatus(l, repo);
        return (
          <li key={l.id}>
            <Link href={`${pathname}?loop=${l.id}`} scroll={false} className="grid gap-3 py-4 transition-colors hover:bg-panel-2/50 sm:grid-cols-[minmax(0,1fr)_200px] sm:items-center sm:gap-6 sm:px-2">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{l.title}</span>
                <span className={clsx("block text-sm", TONE_TEXT[s.tone])}>
                  {s.label}
                  <span className="text-ink-3"> ({ages[l.id]} at this station)</span>
                </span>
              </span>
              <MiniLine workflow={repo.workflow} colorIndex={repo.colorIndex} occupied={[l.stage]} labels />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** The repo's pre-PR checklist. Ticks live on each loop, so this only edits the list. */
export function Checklist({ repoId, items }: { repoId: number; items: string[] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(items.join("\n"));
  const { run, pending } = useAction();

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(() => updateRepo(repoId, { checklist: draft.split("\n") }), () => setEditing(false));
        }}
      >
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={6} className="field" aria-label="Checklist, one item per line" />
        <p className="mt-1 text-xs text-ink-3">One item per line.</p>
        <div className="mt-2 flex gap-2">
          <button disabled={pending} className="btn btn-primary">Save list</button>
          <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost">Cancel</button>
        </div>
      </form>
    );
  }

  return (
    <div>
      {items.length === 0 ? (
        <p className="text-sm text-ink-3">No checks yet. Sync GitHub to read the contributing guide and PR template, or add your own.</p>
      ) : (
        <>
          <ul className="space-y-1.5 text-sm">
            {items.map((item) => (
              <li key={item} className="flex gap-2.5">
                <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-rule-strong" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-3">Tick these off inside each loop, so every PR keeps its own progress.</p>
        </>
      )}
      <div className="mt-3 flex gap-1">
        <button onClick={() => setEditing(true)} className="btn btn-ghost text-xs">
          <Pencil className="size-3.5" /> Edit
        </button>
      </div>
    </div>
  );
}

export function SetupNotes({ repoId, initial }: { repoId: number; initial: string }) {
  const [value, setValue] = useState(initial);
  const { run, pending } = useAction();
  const dirty = value !== initial;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateRepo(repoId, { setupNotes: value }));
      }}
    >
      <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={4} placeholder="How to build it, run the tests, and anything that tripped you up." className="field leading-relaxed" aria-label="Setup notes" />
      {dirty && <button disabled={pending} className="btn btn-primary mt-2">Save notes</button>}
    </form>
  );
}

export function CopyProofPack({ markdown, count }: { markdown: string; count: number }) {
  const toast = useToast();
  return (
    <button
      className="btn btn-quiet w-full"
      disabled={count === 0}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(markdown);
          toast("Copied as Markdown. Paste it into your proposal’s contributions section.");
        } catch {
          toast("Couldn’t reach the clipboard.", "error");
        }
      }}
    >
      <ClipboardCopy className="size-4" /> Copy {count} contribution{count === 1 ? "" : "s"} as Markdown
    </button>
  );
}

export function LogActivity({ repoId }: { repoId: number }) {
  const { run, pending } = useAction();
  const [kind, setKind] = useState<"help" | "review-given" | "note">("help");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const kinds = [
    { value: "help", label: "Helped someone" },
    { value: "review-given", label: "Reviewed a PR" },
    { value: "note", label: "Note" },
  ] as const;
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => logActivity({ repoId, kind, title, url }), () => (setTitle(""), setUrl("")));
      }}
    >
      <div role="radiogroup" aria-label="Kind of activity" className="flex flex-wrap gap-1.5">
        {kinds.map((k) => (
          <button
            key={k.value}
            type="button"
            role="radio"
            aria-checked={kind === k.value}
            onClick={() => setKind(k.value)}
            className={clsx("chip border text-xs transition-colors", kind === k.value ? "border-ink bg-ink text-page" : "border-rule-strong text-ink-2 hover:border-ink-3")}
          >
            {k.label}
          </button>
        ))}
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Answered a setup question in #help" className="field" aria-label="What you did" />
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link (optional)" className="field" aria-label="Link" />
      <button disabled={pending || !title.trim()} className="btn btn-quiet">Log it</button>
    </form>
  );
}

export function AddContact({ orgId }: { orgId: number }) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction();
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="btn btn-ghost text-xs">
        <Plus className="size-3.5" /> Add a person
      </button>
    );
  return (
    <form
      className="mt-2 grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(
          () => addContact({ orgId, name: String(f.get("name")), handle: String(f.get("handle")), role: String(f.get("role")), timezone: String(f.get("timezone")) }),
          () => setOpen(false),
        );
      }}
    >
      <input name="name" placeholder="Name" className="field" required aria-label="Name" />
      <div className="grid grid-cols-2 gap-2">
        <input name="handle" placeholder="@handle" className="field" aria-label="Handle" />
        <input name="timezone" placeholder="Europe/Berlin" className="field" aria-label="Time zone" />
      </div>
      <input name="role" placeholder="Maintainer, mentor, org admin…" className="field" aria-label="Role" />
      <div className="flex gap-2">
        <button disabled={pending} className="btn btn-primary">Add</button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">Cancel</button>
      </div>
    </form>
  );
}

export function TouchContact({ id, followUpAt }: { id: number; followUpAt?: string | null }) {
  const { run, pending } = useAction();
  return (
    <span className="flex shrink-0 items-center gap-1">
      <select
        aria-label="Remind me to follow up"
        disabled={pending}
        value=""
        onChange={(e) => e.target.value && run(() => setFollowUp(id, { days: Number(e.target.value) }))}
        className="field w-auto py-1 text-xs"
      >
        <option value="">{followUpAt ? "Change reminder" : "Remind me"}</option>
        <option value="3">in 3 days</option>
        <option value="7">in 1 week</option>
        <option value="14">in 2 weeks</option>
        <option value="30">in 1 month</option>
        {followUpAt && <option value="0">Clear reminder</option>}
      </select>
      <button disabled={pending} onClick={() => run(() => touchContact(id))} className="btn btn-ghost px-2 text-xs" title="Record that you talked today and clear any reminder">
        Talked today
      </button>
    </span>
  );
}

export function RepoSettings({ repo, programs }: { repo: Repo; programs: { id: string; name: string }[] }) {
  const { run, pending } = useAction();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(() =>
          updateRepo(repo.id, {
            workflow: f.get("workflow") as Workflow,
            staleDays: Number(f.get("staleDays")),
            claimDays: Number(f.get("claimDays")),
            code: String(f.get("code")),
            programId: String(f.get("programId") ?? ""),
            discordChannelUrl: String(f.get("discordChannelUrl") ?? ""),
          }),
        );
      }}
    >
      <label className="block">
        <span className="text-sm font-semibold">Program</span>
        <span className="mb-1.5 block text-xs text-ink-3">Which program this repo is for. It files the line under that program everywhere.</span>
        <select name="programId" defaultValue={repo.programId ?? ""} className="field">
          <option value="">No program yet</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-semibold">How it takes contributions</span>
        <select name="workflow" defaultValue={repo.workflow} className="field mt-1.5">
          {(Object.keys(WORKFLOW_LABELS) as Workflow[]).map((w) => (
            <option key={w} value={w}>{WORKFLOW_LABELS[w].name}</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="text-sm font-semibold">Ping after</span>
          <input name="staleDays" type="number" min={1} defaultValue={repo.staleDays} className="field mt-1.5" />
          <span className="text-xs text-ink-3">days</span>
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Claim lasts</span>
          <input name="claimDays" type="number" min={1} defaultValue={repo.claimDays} className="field mt-1.5" />
          <span className="text-xs text-ink-3">days</span>
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Code</span>
          <input name="code" maxLength={2} defaultValue={repo.code} className="field mt-1.5 uppercase" />
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-semibold">Discord channel link</span>
        <input name="discordChannelUrl" defaultValue={repo.discordChannelUrl ?? ""} placeholder="https://discord.com/channels/…" className="field mt-1.5" />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={pending} className="btn btn-primary">Save settings</button>
        <button
          type="button"
          disabled={pending}
          onClick={() => confirm(`Remove ${repo.owner}/${repo.name} from your lines? Its history is kept.`) && run(() => archiveRepo(repo.id))}
          className="btn btn-ghost text-urgent hover:text-urgent"
        >
          Remove from lines
        </button>
      </div>
    </form>
  );
}
