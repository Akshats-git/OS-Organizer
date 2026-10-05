const DAY = 86_400_000;

export function daysSince(iso: string | null | undefined, now = Date.now()): number {
  if (!iso) return Infinity;
  return (now - new Date(iso).getTime()) / DAY;
}

/** "just now", "5h", "3d", "2w" — compact ages for dense rows. */
export function age(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const ms = now - new Date(iso).getTime();
  const h = ms / 3_600_000;
  if (h < 1) return "just now";
  if (h < 24) return `${Math.floor(h)}h`;
  const d = h / 24;
  if (d < 14) return `${Math.floor(d)}d`;
  if (d < 60) return `${Math.floor(d / 7)}w`;
  return `${Math.floor(d / 30)}mo`;
}

export function ageLong(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const d = Math.floor((now - new Date(iso).getTime()) / DAY);
  if (d <= 0) {
    const h = Math.floor((now - new Date(iso).getTime()) / 3_600_000);
    return h <= 0 ? "just now" : `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}

export function daysUntil(date: string, now = new Date()): number {
  const target = new Date(date + "T00:00:00");
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / DAY);
}

export function formatDate(date: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return new Date(date.length === 10 ? date + "T00:00:00" : date).toLocaleDateString("en-US", opts);
}
