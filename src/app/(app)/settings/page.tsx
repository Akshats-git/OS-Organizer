import clsx from "clsx";
import { Mail } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { DiscordMark, GitHubMark } from "@/components/icons";
import { ClearDemoButton, SyncButton } from "@/components/settings-widgets";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { getIntegrationStatus } from "@/lib/data";
import { ageLong } from "@/lib/time";

export const metadata: Metadata = { title: "Settings" };

function Status({ tone, children }: { tone: "ok" | "off" | "soon"; children: ReactNode }) {
  return (
    <span className={clsx("chip", tone === "ok" ? "bg-ok-bg text-ok" : tone === "soon" ? "bg-soon-bg text-soon" : "bg-panel-2 text-ink-2")}>
      <span className={clsx("size-1.5 rounded-full", tone === "ok" ? "bg-ok" : tone === "soon" ? "bg-soon" : "bg-ink-3")} />
      {children}
    </span>
  );
}

function Integration({ icon, title, status, children }: { icon: ReactNode; title: string; status: ReactNode; children: ReactNode }) {
  return (
    <section className="panel p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-9 place-items-center rounded-full bg-panel-2 text-ink">{icon}</span>
        <h2 className="type-display text-2xl">{title}</h2>
        <span className="ml-auto">{status}</span>
      </div>
      <div className="mt-4 space-y-4 text-sm text-ink-2">{children}</div>
    </section>
  );
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-ink-3">{children}</ol>;
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-panel-2 px-1.5 py-0.5 text-[0.8125rem] text-ink">{children}</code>;
}

export default async function SettingsPage() {
  await connection();
  const s = await getIntegrationStatus();

  return (
    <>
      <header className="mb-8 lg:mb-10">
        <h1 className="type-display text-[2.5rem] leading-none sm:text-[3rem]">Settings</h1>
        <p className="mt-2 max-w-[62ch] text-ink-2">Connect the places your open source work happens. Everything runs on your machine, and secrets stay in your <Code>.env</Code> file.</p>
      </header>

      <div className="grid max-w-3xl gap-5">
        <Integration
          icon={<GitHubMark className="size-5" />}
          title="GitHub"
          status={s.github.configured ? <Status tone="ok">{s.github.login ? `Connected as ${s.github.login}` : "Token added"}</Status> : <Status tone="off">Not connected</Status>}
        >
          <p>Pulls your PRs, issues and reviews in each tracked repo, moves loops forward, spots other PRs on issues you’ve claimed, and reads each repo’s contributing rules.</p>
          {s.github.configured ? (
            <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] bg-panel-2 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{s.github.lastSync ? `Last synced ${ageLong(s.github.lastSync)}` : "Not synced yet"}</span>
                {s.github.lastResult && <span className="block text-xs">{s.github.lastResult}</span>}
              </span>
              <SyncButton />
            </div>
          ) : (
            <Steps>
              <li>Create a classic personal access token at github.com/settings/tokens with the <Code>notifications</Code> and <Code>read:user</Code> scopes. Public repos need nothing more.</li>
              <li>Add <Code>GITHUB_TOKEN=…</Code> to <Code>.env</Code> and restart the app.</li>
              <li>Optional: run <Code>pnpm sync</Code> from cron every 15 minutes, or call <Code>/api/sync</Code> with your secret.</li>
            </Steps>
          )}
        </Integration>

        <Integration
          icon={<DiscordMark className="size-5" />}
          title="Discord"
          status={
            s.discord.lastIngest ? <Status tone="ok">Last message {ageLong(s.discord.lastIngest)}</Status>
            : s.discord.botConfigured ? <Status tone="soon">Waiting for a forwarded message</Status>
            : <Status tone="off">Not connected</Status>
          }
        >
          <p>
            Bots can’t read org servers, and reading them with your own account breaks Discord’s rules. Instead, forward any message to an inbox channel in your own server. The bot files it here and replies with buttons to choose its line.
          </p>
          <Steps>
            <li>Create an application at discord.com/developers, add a bot, and turn on the Message Content intent.</li>
            <li>Make a private server for yourself, add an <Code>#inbox</Code> channel, and invite the bot with the Send Messages and Read Message History permissions.</li>
            <li>Set <Code>DISCORD_BOT_TOKEN</Code>, <Code>DISCORD_INBOX_CHANNEL_ID</Code>, <Code>DISCORD_GUILD_ID</Code>, <Code>APP_URL</Code> and <Code>INGEST_SECRET</Code> in <Code>.env</Code>.</li>
            <li>Run <Code>pnpm bot</Code> alongside the app. Use <Code>/today</Code> in your server for the day’s list.</li>
          </Steps>
          <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-4">
            <span className="flex-1">
              <span className="block font-semibold text-ink">Alerts</span>
              <span className="block text-xs">Merges, review requests, failing checks and claim collisions, posted to a channel through a webhook in <Code>DISCORD_WEBHOOK_URL</Code>.</span>
            </span>
            {s.discord.webhookConfigured ? <Status tone="ok">On</Status> : <Status tone="off">Off</Status>}
          </div>
        </Integration>

        <Integration
          icon={<Mail className="size-5" />}
          title="Gmail"
          status={s.gmail.lastIngest ? <Status tone="ok">Last email {ageLong(s.gmail.lastIngest)}</Status> : <Status tone="off">Not connected</Status>}
        >
          <p>
            For what GitHub can’t see: mailing lists, program announcements and mentor emails. It also sends your morning briefing. A small Apps Script in your own Google account forwards labelled threads, so there is no OAuth app to verify and no weekly sign-in.
          </p>
          <Steps>
            <li>Create a Gmail filter that applies the label <Code>os-organizer</Code>, for example to your target orgs’ mailing lists.</li>
            <li>At script.google.com, create a project and paste in <Code>integrations/gmail/Code.gs</Code> from this repo.</li>
            <li>In Project Settings, add the script properties <Code>APP_URL</Code> (a public URL for this app) and <Code>INGEST_SECRET</Code>.</li>
            <li>Optionally add <Code>BRIEFING_TO</Code> (the address for the morning briefing; defaults to that Google account) and <Code>BRIEFING_HOUR</Code> (default 8).</li>
            <li>Run <Code>setup</Code> once and approve access. It then checks every 5 minutes and emails you the briefing each morning, skipping days with nothing pressing.</li>
          </Steps>
        </Integration>

        {!s.ingestSecretConfigured && (
          <p className="rounded-[var(--radius-control)] bg-soon-bg px-4 py-3 text-sm text-soon">
            Set <Code>INGEST_SECRET</Code> before exposing the app beyond your machine. Without it, the inbox and sync endpoints only accept requests in development.
          </p>
        )}

        <section className="panel p-5 sm:p-6">
          <h2 className="type-display text-2xl">Appearance</h2>
          <div className="mt-4 max-w-[220px]">
            <ThemeToggle />
          </div>
        </section>

        {s.demo && (
          <section className="panel p-5 sm:p-6">
            <h2 className="type-display text-2xl">Demo data</h2>
            <p className="mb-4 mt-1 text-sm text-ink-2">The five orgs you see now are made up, to show how the app works. Clearing them keeps programs and dates.</p>
            <ClearDemoButton />
          </section>
        )}
      </div>
    </>
  );
}
