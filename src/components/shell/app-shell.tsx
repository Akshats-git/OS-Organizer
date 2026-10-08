"use client";

import clsx from "clsx";
import { CalendarDays, House, Inbox, Search, Settings, Waypoints } from "lucide-react";
import { MotionConfig } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BrandMark } from "@/components/icons";
import { LineBullet } from "@/components/line-bullet";
import { ToastProvider } from "@/components/toast";
import { NO_PROGRAM } from "@/lib/programs";
import { CommandPalette, type LineGroup, type PaletteRepo } from "./command-palette";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/", label: "Today", icon: House },
  { href: "/lines", label: "Lines", icon: Waypoints },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/programs", label: "Programs", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children, groups, inboxCount }: { children: ReactNode; groups: LineGroup[]; inboxCount: number }) {
  const pathname = usePathname();
  const repos: PaletteRepo[] = groups.flatMap((g) => g.repos);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-page">
          Skip to content
        </a>
        <div className="lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
          {/* Desktop rail */}
          <aside className="sticky top-0 hidden h-dvh flex-col border-r border-rule bg-panel lg:flex">
            <Link href="/" className="flex items-center gap-2.5 px-5 pb-5 pt-6">
              <BrandMark className="size-7" />
              <span className="type-display text-[1.375rem]">OS Organizer</span>
            </Link>
            <div className="px-3">
              <button
                onClick={() => setPaletteOpen(true)}
                className="flex w-full items-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] border border-rule-strong bg-page px-3 py-2 text-left text-[0.8125rem] text-ink-3 transition-colors hover:border-ink-3 hover:text-ink-2"
              >
                <Search className="size-4" />
                <span className="flex-1 truncate">Search or paste a link</span>
                <kbd className="kbd">⌘K</kbd>
              </button>
            </div>
            <nav aria-label="Main" className="mt-4 px-3">
              <ul className="space-y-0.5">
                {NAV.map(({ href, label, icon: Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={isActive(href) ? "page" : undefined}
                      className={clsx(
                        "flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-sm font-semibold transition-colors",
                        isActive(href) ? "bg-ink text-page" : "text-ink-2 hover:bg-panel-2 hover:text-ink",
                      )}
                    >
                      <Icon className="size-[18px]" strokeWidth={2} />
                      <span className="flex-1">{label}</span>
                      {href === "/inbox" && inboxCount > 0 && (
                        <span className={clsx("numerals min-w-5 rounded-full px-1.5 text-center text-xs", isActive(href) ? "bg-page text-ink" : "bg-ink text-page")}>
                          {inboxCount}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {repos.length > 0 && (
              <div className="mt-7 min-h-0 flex-1 overflow-y-auto px-3 pb-2">
                {groups.map((group) => (
                  <section key={group.key} className="mb-4 last:mb-0">
                    <Link
                      href={group.key === NO_PROGRAM ? "/lines" : `/lines?program=${group.key}`}
                      className="flex items-center gap-2 px-3 pb-1.5 text-xs font-semibold text-ink-3 transition-colors hover:text-ink-2"
                    >
                      <span className="truncate tracking-[0.04em]">{group.key === NO_PROGRAM ? "No program" : group.label}</span>
                      <span className="numerals ml-auto text-[0.6875rem] text-ink-3">{group.repos.length}</span>
                    </Link>
                    <ul className="space-y-0.5">
                      {group.repos.map((r) => (
                        <li key={r.id}>
                          <Link
                            href={`/repos/${r.slug}`}
                            aria-current={pathname === `/repos/${r.slug}` ? "page" : undefined}
                            className={clsx(
                              "flex items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-1.5 text-sm transition-colors",
                              pathname === `/repos/${r.slug}` ? "bg-panel-2 font-semibold text-ink" : "text-ink-2 hover:bg-panel-2 hover:text-ink",
                            )}
                          >
                            <LineBullet code={r.code} colorIndex={r.colorIndex} size="sm" />
                            <span className="truncate">{r.name}</span>
                            <span className="ml-auto truncate text-xs text-ink-3">{r.owner}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
            <div className="mt-auto border-t border-rule px-3 py-3">
              <ThemeToggle />
            </div>
          </aside>

          {/* Mobile top bar */}
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-rule bg-panel/90 px-4 py-3 backdrop-blur lg:hidden">
            <Link href="/" className="flex items-center gap-2">
              <BrandMark className="size-6" />
              <span className="type-display text-lg">OS Organizer</span>
            </Link>
            <button onClick={() => setPaletteOpen(true)} className="btn btn-quiet ml-auto px-2.5" aria-label="Search or paste a link">
              <Search className="size-4" />
            </button>
          </header>

          <main id="main" className="min-w-0 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">
            <div className="mx-auto max-w-[1180px]">{children}</div>
          </main>
        </div>

        {/* Mobile tab bar */}
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          <ul className="grid grid-cols-5">
            {NAV.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={isActive(href) ? "page" : undefined}
                  className={clsx("relative flex flex-col items-center gap-0.5 pb-2 pt-2.5 text-[0.6875rem] font-semibold", isActive(href) ? "text-ink" : "text-ink-3")}
                >
                  {isActive(href) && <span className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-ink" />}
                  <span className="relative">
                    <Icon className="size-5" strokeWidth={isActive(href) ? 2.25 : 1.9} />
                    {href === "/inbox" && inboxCount > 0 && (
                      <span className="numerals absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-ink px-1 text-center text-[0.625rem] leading-4 text-page">{inboxCount}</span>
                    )}
                  </span>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} groups={groups} />
      </ToastProvider>
    </MotionConfig>
  );
}
