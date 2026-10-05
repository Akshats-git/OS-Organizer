/** Post an alert to your own Discord server through a channel webhook. */
export async function notifyDiscord(lines: string[]) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url || lines.length === 0) return false;
  const content = lines.join("\n").slice(0, 1900);
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
  });
  return res.ok;
}
