"use client";

import clsx from "clsx";
import { Plus, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { addRepo } from "@/app/actions";
import type { Workflow } from "@/db/schema";
import { WORKFLOW_LABELS } from "@/lib/stages";
import { useAction } from "./use-action";

export function AddRepoButton({ programs }: { programs: { id: string; name: string }[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const open = params.get("add") === "1";
  const setOpen = (o: boolean) => {
    const next = new URLSearchParams(params);
    if (o) next.set("add", "1");
    else next.delete("add");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary">
        <Plus className="size-4" strokeWidth={2.5} /> Add a repo
      </button>
      <AnimatePresence>{open && <Dialog programs={programs} onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function Dialog({ programs, onClose }: { programs: { id: string; name: string }[]; onClose: () => void }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [workflow, setWorkflow] = useState<Workflow>("ask-first");
  const [chatUrl, setChatUrl] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <motion.div className="absolute inset-0 bg-[rgb(12_18_27/0.45)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.form
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-repo-title"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16, transition: { duration: 0.15 } }}
        transition={{ type: "spring", stiffness: 480, damping: 40 }}
        className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[20px] border border-rule bg-panel p-5 shadow-float sm:rounded-[var(--radius-panel)] sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run(
            () =>
              addRepo({
                github: String(f.get("github") ?? ""),
                orgName: String(f.get("orgName") ?? ""),
                programId: String(f.get("programId") ?? ""),
                workflow,
                chatUrl,
                discordGuildId: String(f.get("discordGuildId") ?? ""),
              }),
            (r) => "slug" in r && r.slug && router.push(`/repos/${r.slug}`),
          );
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="add-repo-title" className="type-display text-2xl">Add a repo</h2>
            <p className="mt-1 text-sm text-ink-2">It gets its own line and color. Sync GitHub afterwards to pull in your PRs and its contribution rules.</p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost px-2" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-6 space-y-5">
          <Field label="GitHub repo" hint="A link or owner/name.">
            <input name="github" required autoFocus placeholder="sympy/sympy" className="field" autoComplete="off" />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Organization" hint="Defaults to the repo owner.">
              <input name="orgName" placeholder="SymPy" className="field" />
            </Field>
            <Field label="Program">
              <select name="programId" className="field" defaultValue="gsoc">
                <option value="">None yet</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold">How does this repo take contributions?</legend>
            <div className="mt-2 grid gap-2">
              {(Object.keys(WORKFLOW_LABELS) as Workflow[]).map((w) => (
                <label
                  key={w}
                  className={clsx(
                    "flex cursor-pointer gap-3 rounded-[var(--radius-control)] border px-3 py-2.5 transition-colors",
                    workflow === w ? "border-ink bg-panel-2" : "border-rule-strong hover:border-ink-3",
                  )}
                >
                  <input type="radio" name="workflow" value={w} checked={workflow === w} onChange={() => setWorkflow(w)} className="mt-1 accent-[var(--ink)]" />
                  <span>
                    <span className="block text-sm font-semibold">{WORKFLOW_LABELS[w].name}</span>
                    <span className="block text-xs text-ink-2">{WORKFLOW_LABELS[w].hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <Field label="Chat link" hint="Discord invite, Zulip, Slack or mailing list.">
            <input name="chatUrl" value={chatUrl} onChange={(e) => setChatUrl(e.target.value)} placeholder="https://discord.gg/…" className="field" />
          </Field>
          {/discord/.test(chatUrl) && (
            <Field label="Discord server ID" hint="Lets the bot file forwarded messages here automatically. In Discord, turn on Developer Mode, right-click the server icon, then Copy Server ID.">
              <input name="discordGuildId" inputMode="numeric" placeholder="123456789012345678" className="field" />
            </Field>
          )}
        </div>

        <div className="mt-7 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary">Add repo</button>
        </div>
      </motion.form>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      {hint && <span className="mb-1.5 block text-xs text-ink-3">{hint}</span>}
      {!hint && <span className="mb-1.5 block" />}
      {children}
    </label>
  );
}
