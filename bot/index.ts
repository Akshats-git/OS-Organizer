/**
 * OS Organizer Discord bot.
 *
 * Lives in YOUR private server only. Forward any message (from an org's server,
 * a DM, anywhere) into your inbox channel; the bot sends it to the app and
 * replies with buttons to file it under the right line.
 *
 * Run: pnpm bot   (needs DISCORD_BOT_TOKEN, DISCORD_INBOX_CHANNEL_ID, DISCORD_GUILD_ID, APP_URL, INGEST_SECRET)
 */
import "dotenv/config";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  MessageReferenceType,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  type Message,
} from "discord.js";

const { DISCORD_BOT_TOKEN, DISCORD_INBOX_CHANNEL_ID, DISCORD_GUILD_ID, INGEST_SECRET } = process.env;
const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

if (!DISCORD_BOT_TOKEN || !DISCORD_INBOX_CHANNEL_ID) {
  console.error("Set DISCORD_BOT_TOKEN and DISCORD_INBOX_CHANNEL_ID in .env first. See the Settings page for setup steps.");
  process.exit(1);
}

type RepoOption = { id: number; code: string; name: string; org: string };
type IngestResponse = { item: { id: number; title: string }; suggestion: { id: number; name: string } | null; repos: RepoOption[] };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${APP_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(INGEST_SECRET ? { "x-ingest-secret": INGEST_SECRET } : {}), ...init?.headers },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `App returned ${res.status}`);
  return body;
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel],
});

/** Extract the useful parts of a message, following forwards back to their source. */
function describe(message: Message) {
  const ref = message.reference;
  if (ref?.type === MessageReferenceType.Forward) {
    const snap = message.messageSnapshots.first();
    const url = ref.guildId && ref.messageId ? `https://discord.com/channels/${ref.guildId}/${ref.channelId}/${ref.messageId}` : null;
    return { text: snap?.content || "(forwarded message with no text)", url, guildId: ref.guildId ?? null, author: "forwarded message" };
  }
  // A typed note, possibly just a pasted message link.
  const link = message.content.match(/https:\/\/(?:\w+\.)?discord(?:app)?\.com\/channels\/(\d+)\/\d+\/\d+/);
  return { text: message.content, url: link?.[0] ?? message.url, guildId: link?.[1] ?? null, author: "note" };
}

const fileButtons = (inboxId: number, repoId: number) =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`file:${inboxId}:${repoId}:approval`).setLabel("It’s an approval").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`file:${inboxId}:${repoId}:ask`).setLabel("It’s my ask").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`file:${inboxId}:${repoId}:note`).setLabel("Save to timeline").setStyle(ButtonStyle.Secondary),
  );

const repoPicker = (inboxId: number, repos: RepoOption[], selected?: number) =>
  new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`pick:${inboxId}`)
      .setPlaceholder("Choose a line")
      .addOptions(repos.slice(0, 25).map((r) => ({ label: `${r.code} · ${r.name}`, description: r.org.slice(0, 100), value: String(r.id), default: r.id === selected }))),
  );

client.once(Events.ClientReady, async (c) => {
  console.log(`Bot ready as ${c.user.tag}. Forward messages to <#${DISCORD_INBOX_CHANNEL_ID}>.`);
  if (DISCORD_GUILD_ID) {
    const today = new SlashCommandBuilder().setName("today").setDescription("What needs you today across your lines");
    await new REST().setToken(DISCORD_BOT_TOKEN).put(Routes.applicationGuildCommands(c.user.id, DISCORD_GUILD_ID), { body: [today.toJSON()] });
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  const isInbox = message.channelId === DISCORD_INBOX_CHANNEL_ID || message.channel.type === ChannelType.DM;
  if (!isInbox) return;

  const d = describe(message);
  try {
    const res = await api<IngestResponse>("/api/inbox", {
      method: "POST",
      body: JSON.stringify({
        source: "discord",
        externalId: message.id,
        title: d.text.slice(0, 280),
        body: d.text,
        url: d.url,
        author: d.author,
        context: d.guildId ? `server ${d.guildId}` : "your inbox",
        discordGuildId: d.guildId,
        receivedAt: message.createdAt.toISOString(),
      }),
    });
    if (!res.repos.length) {
      await message.reply("Saved to your inbox. Add a repo in the app to file messages from here.");
      return;
    }
    const rows = res.suggestion
      ? [fileButtons(res.item.id, res.suggestion.id), repoPicker(res.item.id, res.repos, res.suggestion.id)]
      : [repoPicker(res.item.id, res.repos)];
    await message.reply({
      content: res.suggestion ? `Looks like **${res.suggestion.name}**. What is it?` : "Saved to your inbox. Which line is it for?",
      components: rows,
      allowedMentions: { repliedUser: false },
    });
  } catch (err) {
    await message.reply(`Couldn’t reach the app at ${APP_URL}: ${(err as Error).message}`);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("pick:")) {
      const inboxId = Number(interaction.customId.split(":")[1]);
      const repoId = Number(interaction.values[0]);
      const options = interaction.component.options.map((o) => ({ id: Number(o.value), code: o.label.split(" · ")[0], name: o.label.split(" · ")[1] ?? o.label, org: o.description ?? "" }));
      await interaction.update({
        content: `Filing under **${options.find((o) => o.id === repoId)?.name ?? "that line"}**. What is it?`,
        components: [fileButtons(inboxId, repoId), repoPicker(inboxId, options, repoId)],
      });
    } else if (interaction.isButton() && interaction.customId.startsWith("file:")) {
      const [, inboxId, repoId, as] = interaction.customId.split(":");
      const res = await api<{ message: string }>(`/api/inbox/${inboxId}/file`, { method: "POST", body: JSON.stringify({ repoId: Number(repoId), as }) });
      await interaction.update({ content: `✅ ${res.message}`, components: [] });
    } else if (interaction.isChatInputCommand() && interaction.commandName === "today") {
      const data = await api<{ actions: { tone: string; title: string; href?: string | null; repo: { code: string } | null }[] }>("/api/today");
      const mark = { urgent: "🔴", soon: "🟠", nudge: "⚪" } as Record<string, string>;
      const lines = data.actions.slice(0, 12).map((a) => `${mark[a.tone] ?? "•"} ${a.repo ? `\`${a.repo.code}\` ` : ""}${a.title}${a.href?.startsWith("http") ? ` — <${a.href}>` : ""}`);
      await interaction.reply({ content: lines.length ? lines.join("\n") : "Nothing needs you right now. 🎉", allowedMentions: { parse: [] } });
    }
  } catch (err) {
    const content = `Something went wrong: ${(err as Error).message}`;
    if (interaction.isRepliable()) {
      if (interaction.replied || interaction.deferred) await interaction.followUp({ content, ephemeral: true });
      else await interaction.reply({ content, ephemeral: true });
    }
  }
});

client.login(DISCORD_BOT_TOKEN);
