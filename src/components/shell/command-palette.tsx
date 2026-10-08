"use client";

import { Command } from "cmdk";
import { CalendarDays, CornerDownLeft, ExternalLink, House, Inbox, Moon, Plus, RefreshCw, Settings, Waypoints } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { addRepo, startLoop, syncNow } from "@/app/actions";
import { DiscordMark, GitHubMark } from "@/components/icons";
import { LineBullet } from "@/components/line-bullet";
import { useAction } from "@/components/use-action";
import { parseLink } from "@/lib/links";
import { NO_PROGRAM } from "@/lib/programs";
import { setTheme } from "./theme-toggle";

export type PaletteRepo = { id: number; slug: string; code: string; colorIndex: number; name: string; owner: string };
/** Repos as the rail and the palette show them: under their program. */
export type LineGroup = { key: string; label: string; repos: PaletteRepo[] };

export function CommandPalette({ open, onOpenChange, groups }: { open: boolean; onOpenChange: (o: boolean) => void; groups: LineGroup[] }) {
  const router = useRouter();
  const repos = useMemo(() => groups.flatMap((g) => g.repos), [groups]);
  const [query, setQuery] = useState("");
  const { run, pending } = useAction();

  const link = useMemo(() => parseLink(query), [query]);
  const linkedRepo = link && link.kind !== "discord-message"
    ? repos.find((r) => r.owner.toLowerCase() === link.owner.toLowerCase() && r.name.toLowerCase() === link.repo.toLowerCase())
    : undefined;

  const close = () => {
    setQuery("");
    onOpenChange(false);
  };
  const go = (href: string) => {
    close();
    router.push(href);
  };
  const act = (fn: Parameters<typeof run>[0], after?: () => void) => run(fn, () => (close(), after?.()));

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
          <motion.div
            className="absolute inset-0 bg-[rgb(12_18_27/0.45)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={close}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.99, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 560, damping: 40 }}
            className="relative w-full max-w-xl overflow-hidden rounded-[var(--radius-panel)] border border-rule bg-panel shadow-float"
          >
            <Command
              label="Command palette"
              shouldFilter={!link}
              onKeyDown={(e) => e.key === "Escape" && close()}
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-ink-3"
            >
              <Command.Input
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder="Search, or paste a GitHub or Discord link"
                className="w-full border-b border-rule bg-transparent px-4 py-3.5 text-base outline-none placeholder:text-ink-3"
              />
              <Command.List className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-6 text-center text-sm text-ink-3">Nothing matches. Try a repo name or paste a link.</Command.Empty>

                {link && (
                  <Command.Group heading="From this link">
                    {(link.kind === "github-issue" || link.kind === "github-pr") && linkedRepo && (
                      <>
                        <Item
                          icon={<LineBullet code={linkedRepo.code} colorIndex={linkedRepo.colorIndex} size="sm" />}
                          onSelect={() => act(() => startLoop({ repoId: linkedRepo.id, title: `${link.kind === "github-pr" ? "PR" : "Issue"} #${link.number}`, link: link.url }), () => router.push(`/repos/${linkedRepo.slug}`))}
                          disabled={pending}
                        >
                          Start a loop in {linkedRepo.name} from #{link.number}
                        </Item>
                        <Item icon={<ExternalLink className="size-4" />} onSelect={() => (close(), window.open(link.url, "_blank", "noopener"))}>
                          Open #{link.number} on GitHub
                        </Item>
                      </>
                    )}
                    {link.kind !== "discord-message" && !linkedRepo && (
                      <Item icon={<GitHubMark className="size-4" />} onSelect={() => act(() => addRepo({ github: `${link.owner}/${link.repo}` }), () => router.push("/lines"))} disabled={pending}>
                        Add {link.owner}/{link.repo} to your lines
                      </Item>
                    )}
                    {link.kind === "github-repo" && linkedRepo && (
                      <Item icon={<LineBullet code={linkedRepo.code} colorIndex={linkedRepo.colorIndex} size="sm" />} onSelect={() => go(`/repos/${linkedRepo.slug}`)}>
                        Open {linkedRepo.name}
                      </Item>
                    )}
                    {link.kind === "discord-message" &&
                      repos.map((r) => (
                        <Item
                          key={r.id}
                          icon={<DiscordMark className="size-4" />}
                          onSelect={() => act(() => startLoop({ repoId: r.id, title: "Asked on Discord", link: link.url }), () => router.push(`/repos/${r.slug}`))}
                          disabled={pending}
                        >
                          Log this as an ask in {r.name}
                        </Item>
                      ))}
                  </Command.Group>
                )}

                {!link && (
                  <>
                    <Command.Group heading="Go to">
                      <Item icon={<House className="size-4" />} onSelect={() => go("/")}>Today</Item>
                      <Item icon={<Waypoints className="size-4" />} onSelect={() => go("/lines")}>Lines</Item>
                      <Item icon={<Inbox className="size-4" />} onSelect={() => go("/inbox")}>Inbox</Item>
                      <Item icon={<CalendarDays className="size-4" />} onSelect={() => go("/programs")}>Programs</Item>
                      <Item icon={<Settings className="size-4" />} onSelect={() => go("/settings")}>Settings</Item>
                    </Command.Group>
                    {groups.map((group) => (
                      <Command.Group key={group.key} heading={group.key === NO_PROGRAM ? "No program" : group.label}>
                        {group.repos.map((r) => (
                          <Item key={r.id} value={`${r.owner}/${r.name} ${r.code} ${group.label}`} icon={<LineBullet code={r.code} colorIndex={r.colorIndex} size="sm" />} onSelect={() => go(`/repos/${r.slug}`)}>
                            {r.name} <span className="text-ink-3">{r.owner}</span>
                          </Item>
                        ))}
                      </Command.Group>
                    ))}
                    <Command.Group heading="Actions">
                      <Item icon={<RefreshCw className="size-4" />} onSelect={() => act(() => syncNow())} disabled={pending}>Sync GitHub now</Item>
                      <Item icon={<Plus className="size-4" />} onSelect={() => go("/lines?add=1")}>Add a repo</Item>
                      <Item icon={<Moon className="size-4" />} value="theme dark" onSelect={() => (setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"), close())}>
                        Switch light or dark
                      </Item>
                    </Command.Group>
                  </>
                )}
              </Command.List>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Item({ children, icon, onSelect, value, disabled }: { children: ReactNode; icon: ReactNode; onSelect: () => void; value?: string; disabled?: boolean }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      disabled={disabled}
      className="group flex cursor-pointer items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-sm text-ink data-[selected=true]:bg-panel-2 data-[disabled=true]:opacity-50"
    >
      <span className="grid w-5 place-items-center text-ink-2">{icon}</span>
      <span className="flex-1 truncate">{children}</span>
      <CornerDownLeft className="size-3.5 text-ink-3 opacity-0 group-data-[selected=true]:opacity-100" />
    </Command.Item>
  );
}
