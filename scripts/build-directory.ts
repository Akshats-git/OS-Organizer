/**
 * Builds the open source program directory from public sources.
 *
 *   pnpm directory:build            fetch (cached) and write src/data/directory/directory.json
 *   pnpm directory:build --fresh    ignore the cache and refetch everything
 *
 * Sources: the Google Summer of Code archive API, the LFX Mentorship API and
 * Outreachy's per-round intern pages. Summer of Bitcoin has no public data
 * feed, so it is read from the rendered site with a headless browser.
 * scripts/directory-manual.json holds hand-made additions and corrections.
 *
 * Only organization-level facts are kept (names, projects, skills). Nothing
 * about individual contributors or mentors is written to disk.
 *
 * Run it once per cycle. The output is committed, so the app needs no network
 * and no database for this data.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = path.join(process.cwd(), "src/data/directory/directory.json");
const CACHE = path.join(process.cwd(), ".cache/directory");
const FRESH = process.argv.includes("--fresh");
const UA = { "User-Agent": "Mozilla/5.0 (os-organizer directory build)" };

const GSOC_FIRST = 2016;
const GSOC_LAST = new Date().getFullYear() + (new Date().getMonth() >= 9 ? 1 : 0);

// ---------- shapes ----------

type Project = { title: string; tech: string[]; url?: string };
type Year = { projects: number | null; list: Project[] };

type Source = {
  program: string;
  name: string;
  website?: string;
  tagline?: string;
  description?: string;
  logo?: string;
  license?: string;
  source?: string;
  ideas?: string;
  contact?: string;
  categories: string[];
  topics: string[];
  tech: string[];
  /** Year the descriptive fields came from, so the newest record wins. */
  asOf: number;
  years: Record<number, Year>;
};

// ---------- helpers ----------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const file = path.join(CACHE, key.replace(/[^a-z0-9._-]/gi, "_") + ".json");
  if (!FRESH) {
    try {
      return JSON.parse(await readFile(file, "utf8")) as T;
    } catch {}
  }
  const value = await load();
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, JSON.stringify(value));
  return value;
}

async function getJson<T>(url: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return (await res.json()) as T;
    } catch (e) {
      if (attempt === 3) throw e;
      await sleep(800 * attempt);
    }
  }
}

async function getText(url: string): Promise<string> {
  const res = await fetch(url, { headers: UA, redirect: "follow" });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

const stripHtml = (s: string) => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

const clip = (s: string | undefined, n: number) => {
  if (!s) return undefined;
  const t = s.trim();
  if (t.length <= n) return t;
  return t.slice(0, n).replace(/\s+\S*$/, "") + "…";
};

const norm = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");

const slugify = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const TECH_ALIASES: Record<string, string> = {
  js: "javascript",
  nodejs: "node.js",
  node: "node.js",
  reactjs: "react",
  "react.js": "react",
  golang: "go",
  "c plus plus": "c++",
  cpp: "c++",
  py: "python",
  python3: "python",
  "python 3": "python",
  ml: "machine learning",
  ai: "artificial intelligence",
  "vue.js": "vue",
  vuejs: "vue",
  "angular.js": "angularjs",
  postgres: "postgresql",
  k8s: "kubernetes",
  "ruby on rails": "rails",
  ts: "typescript",
};

function tech(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const out: string[] = [];
  for (const raw of tags) {
    if (typeof raw !== "string") continue;
    let t = raw.trim().toLowerCase().replace(/\s+/g, " ");
    if (!t || t.length > 32) continue;
    t = TECH_ALIASES[t] ?? t;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

const GENERIC_HOSTS = new Set([
  "github.com",
  "gitlab.com",
  "bitbucket.org",
  "sourceforge.net",
  "docs.google.com",
  "sites.google.com",
  "medium.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "linkedin.com",
  "wikipedia.org",
  "en.wikipedia.org",
  "summerofcode.withgoogle.com",
]);

/** A bare site root ("https://www.python.org/") is a stable identity; a deep link or a code host is not. */
function rootHost(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "");
    if (GENERIC_HOSTS.has(host) || (u.pathname !== "/" && u.pathname !== "")) return undefined;
    return host;
  } catch {
    return undefined;
  }
}

const cleanUrl = (u?: string | null) => {
  const t = u?.trim();
  return t && /^https?:\/\//i.test(t) ? t : undefined;
};

// ---------- Google Summer of Code ----------

type GOrg = {
  slug: string;
  name: string;
  logo_url?: string;
  website_url?: string;
  tagline?: string;
  description?: string;
  description_html?: string;
  license?: string;
  categories?: string[];
  topic_tags?: string[];
  tech_tags?: string[];
  source_code?: string;
  ideas_link?: string;
  ideas_list_url?: string;
  contact_links?: { name: string; value: string }[];
};
type GProject = { title: string; project_code_url?: string; tech_tags?: string[]; organization_name: string };

async function gsoc(): Promise<{ sources: Source[]; years: Record<number, { orgs: number; projects: number | null }> }> {
  const byName = new Map<string, Source>();
  const years: Record<number, { orgs: number; projects: number | null }> = {};

  for (let year = GSOC_FIRST; year <= GSOC_LAST; year++) {
    const orgsUrl =
      year >= 2026
        ? `https://summerofcode.withgoogle.com/api/program/${year}/organizations/`
        : `https://summerofcode.withgoogle.com/api/archive/programs/${year}/organizations/`;
    let orgs: GOrg[];
    try {
      orgs = await cached(`gsoc-orgs-${year}`, () => getJson<GOrg[]>(orgsUrl));
    } catch (e) {
      console.warn(`gsoc ${year}: no organizations (${(e as Error).message})`);
      continue;
    }
    let projects: GProject[] | null = null;
    if (year <= 2025) {
      try {
        projects = await cached(`gsoc-projects-${year}`, () =>
          getJson<GProject[]>(`https://summerofcode.withgoogle.com/api/archive/programs/${year}/projects/`),
        );
      } catch (e) {
        console.warn(`gsoc ${year}: no projects (${(e as Error).message})`);
      }
    }

    const perOrg = new Map<string, GProject[]>();
    for (const p of projects ?? []) {
      const key = norm(p.organization_name);
      perOrg.set(key, [...(perOrg.get(key) ?? []), p]);
    }

    for (const o of orgs) {
      const key = norm(o.name);
      const description = o.description ?? (o.description_html ? stripHtml(o.description_html) : undefined);
      const contact = o.contact_links?.find((c) => c.name === "email")?.value;
      let s = byName.get(key);
      if (!s) {
        s = { program: "gsoc", name: o.name, categories: [], topics: [], tech: [], asOf: 0, years: {} };
        byName.set(key, s);
      }
      if (year >= s.asOf) {
        s.asOf = year;
        s.name = o.name;
        s.website = cleanUrl(o.website_url) ?? s.website;
        s.tagline = clip(o.tagline, 160) ?? s.tagline;
        s.description = clip(description, 700) ?? s.description;
        s.logo = cleanUrl(o.logo_url) ?? s.logo;
        s.license = o.license?.trim() || s.license;
        s.source = cleanUrl(o.source_code) ?? s.source;
        s.ideas = cleanUrl(o.ideas_link ?? o.ideas_list_url) ?? s.ideas;
        s.contact = contact?.includes("@") ? contact : s.contact;
        s.categories = o.categories?.length ? o.categories : s.categories;
        s.topics = tech(o.topic_tags).slice(0, 8).length ? tech(o.topic_tags).slice(0, 8) : s.topics;
        s.tech = tech(o.tech_tags).length ? tech(o.tech_tags) : s.tech;
      }
      const mine = perOrg.get(key) ?? [];
      s.years[year] = {
        projects: projects ? mine.length : null,
        list: mine.map((p) => ({ title: clip(p.title, 120) ?? p.title, tech: tech(p.tech_tags).slice(0, 5), url: cleanUrl(p.project_code_url) })),
      };
    }
    years[year] = { orgs: orgs.length, projects: projects ? projects.length : null };
    console.log(`gsoc ${year}: ${orgs.length} orgs, ${projects?.length ?? "?"} projects`);
  }
  return { sources: [...byName.values()], years };
}

// ---------- LFX Mentorship ----------

type LProject = {
  name: string;
  status: string;
  industry?: string;
  description?: string;
  apprenticeNeeds?: { skills?: string[] };
  repoLink?: string;
  websiteUrl?: string;
  logoUrl?: string;
  lfProjectName?: string;
  lfProjectLogo?: string;
  programTerms?: { name: string; startDateTime?: number; endDateTime?: number; active?: string }[];
};

async function lfx(): Promise<{ sources: Source[]; years: Record<number, { orgs: number; projects: number | null }> }> {
  const all = await cached("lfx-projects", async () => {
    const out: LProject[] = [];
    let key: string | null = null;
    do {
      const url: string = `https://api.mentorship.lfx.linuxfoundation.org/projects?pageSize=100${key ? `&nextPageKey=${encodeURIComponent(key)}` : ""}`;
      const page = await getJson<{ projects: LProject[]; nextPageKey?: string | null }>(url);
      out.push(...page.projects);
      key = page.nextPageKey ?? null;
      await sleep(150);
    } while (key);
    return out;
  });
  console.log(`lfx: ${all.length} projects fetched`);

  const byOrg = new Map<string, Source>();
  const perYear: Record<number, { orgs: Set<string>; projects: number }> = {};
  for (const p of all) {
    if (!p.lfProjectName || !p.programTerms?.length) continue;
    // A project can run in several terms of one year; count it once per year.
    const years = new Set(p.programTerms.filter((t) => t.startDateTime).map((t) => new Date(t.startDateTime! * 1000).getUTCFullYear()));
    if (!years.size) continue;
    const key = norm(p.lfProjectName);
    let s = byOrg.get(key);
    if (!s) {
      s = { program: "lfx", name: p.lfProjectName, categories: [], topics: [], tech: [], asOf: 0, years: {}, logo: cleanUrl(p.lfProjectLogo) };
      byOrg.set(key, s);
    }
    for (const y of years) {
      const slot = (s.years[y] ??= { projects: 0, list: [] });
      slot.projects = (slot.projects ?? 0) + 1;
      slot.list.push({ title: clip(p.name, 120) ?? p.name, tech: tech(p.apprenticeNeeds?.skills).slice(0, 5), url: cleanUrl(p.repoLink) ?? cleanUrl(p.websiteUrl) });
      (perYear[y] ??= { orgs: new Set(), projects: 0 }).orgs.add(key);
      perYear[y].projects++;
    }
    for (const c of (p.industry ?? "").split(",")) {
      const t = c.trim();
      if (t && !s.categories.includes(t) && s.categories.length < 5) s.categories.push(t);
    }
  }
  const years: Record<number, { orgs: number; projects: number | null }> = {};
  for (const [y, v] of Object.entries(perYear)) years[Number(y)] = { orgs: v.orgs.size, projects: v.projects };
  for (const y of Object.keys(years)) console.log(`lfx ${y}: ${years[Number(y)].orgs} foundations, ${years[Number(y)].projects} projects`);
  return { sources: [...byOrg.values()], years };
}

// ---------- Outreachy ----------

async function outreachy(): Promise<{ sources: Source[]; years: Record<number, { orgs: number; projects: number | null }> }> {
  // /alums/ redirects to the newest round, whose page links to every earlier one.
  const index = await cached("outreachy-index", async () => {
    const res = await fetch("https://www.outreachy.org/alums/", { headers: UA, redirect: "follow" });
    if (!res.ok) throw new Error(`${res.status} outreachy alums`);
    return { url: res.url, html: await res.text() };
  });
  const latest = index.url.match(/\/alums\/(\d{4}-\d{2})\//)?.[1];
  const rounds = [...new Set([...index.html.matchAll(/href="\/alums\/(\d{4}-\d{2})\/"/g)].map((m) => m[1]).concat(latest ?? []))].sort();
  const byOrg = new Map<string, Source>();
  const perYear: Record<number, { orgs: Set<string>; projects: number }> = {};

  for (const round of rounds) {
    const html = await cached(`outreachy-${round}`, async () => {
      await sleep(250);
      return getText(`https://www.outreachy.org/alums/${round}/`);
    });
    const year = Number(round.slice(0, 4));
    let current: string | null = null;
    // Cards in a community run on until the next one with a header.
    for (const card of html.split('<div class="card border').slice(1)) {
      const header = card.match(/<div class="card-header[^"]*">([\s\S]*?)<\/div>/);
      if (header) current = stripHtml(header[1]);
      if (!current) continue;
      const title = card.match(/Project:\s*([^<]+)/)?.[1];
      const skills = card.match(/Project skills:\s*([^<]+)/)?.[1];
      if (!title) continue;
      const key = norm(current);
      let s = byOrg.get(key);
      if (!s) {
        s = { program: "outreachy", name: current, categories: [], topics: [], tech: [], asOf: 0, years: {} };
        byOrg.set(key, s);
      }
      const slot = (s.years[year] ??= { projects: 0, list: [] });
      slot.projects = (slot.projects ?? 0) + 1;
      slot.list.push({
        title: clip(decode(title).trim(), 120)!,
        tech: tech((skills ?? "").split(",").map((x) => decode(x).trim())).slice(0, 5),
      });
      (perYear[year] ??= { orgs: new Set(), projects: 0 }).orgs.add(key);
      perYear[year].projects++;
    }
    console.log(`outreachy ${round}: ok`);
  }
  const years: Record<number, { orgs: number; projects: number | null }> = {};
  for (const [y, v] of Object.entries(perYear)) years[Number(y)] = { orgs: v.orgs.size, projects: v.projects };
  return { sources: [...byOrg.values()], years };
}

// ---------- Summer of Bitcoin ----------

/**
 * summerofbitcoin.org is a client-rendered Softr site with no data feed, so
 * this drives a headless browser. The caches make a re-run cheap; if the site's
 * markup changes, delete .cache/directory/sob-*.json and adjust the parsing.
 */
async function sob(): Promise<{ sources: Source[]; years: Record<number, { orgs: number; projects: number | null }> }> {
  const scraped = await cached("sob-all", async () => {
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const open = async (url: string) => {
        await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
        await page.waitForTimeout(2500);
      };

      await open("https://www.summerofbitcoin.org/organizations");
      const current = await page.evaluate(() => {
        const anchors = [...document.querySelectorAll<HTMLAnchorElement>('a[href*="org-details"]')];
        return anchors.map((a) => {
          // The card is the largest ancestor that still holds only this one link.
          let card: HTMLElement = a;
          while (card.parentElement && card.parentElement.querySelectorAll('a[href*="org-details"]').length === 1) card = card.parentElement;
          return (card.innerText || "").split("\n").map((l) => l.trim()).filter(Boolean);
        });
      });

      await open("https://www.summerofbitcoin.org/past-programs");
      const programLinks = await page.$$eval('a[href*="program-details"]', (as) => [...new Set(as.map((a) => (a as HTMLAnchorElement).href))]);
      const past: { year: number; projects: { description: string; org: string }[] }[] = [];
      for (const url of programLinks) {
        await open(url);
        // Projects load a page at a time behind a "See more" button.
        for (let i = 0; i < 40; i++) {
          const more = page.locator("button, a, [role=button]").filter({ hasText: /See more/ }).first();
          if (!(await more.isVisible().catch(() => false))) break;
          await more.click();
          await page.waitForTimeout(1200);
        }
        const text = await page.innerText("body");
        const year = Number(text.match(/(\d{4}) Program/)?.[1]);
        if (!year) continue;
        const projects: { description: string; org: string }[] = [];
        // Each project reads: contributor, description, organization, then a Softr marker line.
        // The text after the last marker is the "See more" button and the footer, not a project.
        for (const block of text.split("//# sourceURL=softr-custom-code").slice(0, -1)) {
          const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
          if (lines.length >= 3) projects.push({ description: lines.at(-2)!, org: lines.at(-1)! });
        }
        past.push({ year, projects });
      }
      return { current, past };
    } finally {
      await browser.close();
    }
  });

  const byOrg = new Map<string, Source>();
  const slot = (name: string) => {
    const key = norm(name);
    let s = byOrg.get(key);
    if (!s) {
      s = { program: "sob", name, categories: [], topics: [], tech: [], asOf: 0, years: {} };
      byOrg.set(key, s);
    }
    return s;
  };

  const years: Record<number, { orgs: number; projects: number | null }> = {};
  for (const { year, projects } of scraped.past) {
    for (const p of projects) {
      const s = slot(p.org);
      const y = (s.years[year] ??= { projects: 0, list: [] });
      y.projects = (y.projects ?? 0) + 1;
      y.list.push({ title: clip(p.description, 140)!, tech: [] });
    }
    years[year] = { orgs: new Set(projects.map((p) => norm(p.org))).size, projects: projects.length };
  }
  // Card text is: name, one-line description, then technology tags.
  const thisYear = new Date().getFullYear();
  for (const lines of scraped.current) {
    const [name, description, ...tags] = lines;
    if (!name || !description) continue;
    const s = slot(name);
    s.asOf = thisYear;
    s.description = clip(description, 400);
    s.tech = tech(tags);
    s.years[thisYear] ??= { projects: null, list: [] };
  }
  years[thisYear] = { orgs: scraped.current.length, projects: null };
  console.log(`sob: ${Object.keys(years).length} years, ${byOrg.size} orgs`);
  return { sources: [...byOrg.values()], years };
}

// ---------- manual entries (ESoC, corrections) ----------

type Manual = {
  /** Display name -> alternative names it appears under in other programs. */
  aliases?: Record<string, string[]>;
  /** Names that share a website with another organization but are not the same one. */
  separate?: string[];
  orgs?: {
    program: string;
    name: string;
    website?: string;
    description?: string;
    tech?: string[];
    ideas?: string;
    source?: string;
    years: Record<string, { projects?: number; titles?: string[] }>;
  }[];
};

async function manual(): Promise<{ sources: Source[]; aliases: Record<string, string[]>; separate: string[] }> {
  let data: Manual = {};
  try {
    data = JSON.parse(await readFile(path.join(process.cwd(), "scripts/directory-manual.json"), "utf8"));
  } catch {}
  const sources: Source[] = (data.orgs ?? []).map((o) => ({
    program: o.program,
    name: o.name,
    website: cleanUrl(o.website),
    description: o.description,
    ideas: cleanUrl(o.ideas),
    source: cleanUrl(o.source),
    categories: [],
    topics: [],
    tech: tech(o.tech),
    asOf: 0,
    years: Object.fromEntries(
      Object.entries(o.years).map(([y, v]) => [
        Number(y),
        { projects: v.projects ?? v.titles?.length ?? null, list: (v.titles ?? []).map((title) => ({ title, tech: [] })) },
      ]),
    ),
  }));
  return { sources, aliases: data.aliases ?? {}, separate: data.separate ?? [] };
}

// ---------- merge into one directory ----------

type Org = {
  id: string;
  name: string;
  website?: string;
  tagline?: string;
  description?: string;
  logo?: string;
  license?: string;
  source?: string;
  ideas?: string;
  contact?: string;
  categories: string[];
  topics: string[];
  tech: string[];
  participation: Record<string, Record<number, Year>>;
};

function merge(sources: Source[], aliases: Record<string, string[]>, separate: string[]): Org[] {
  const apart = new Set(separate.map(norm));
  // Union-find over sources: same normalized name, a declared alias, or the same bare site root.
  const parent = sources.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };

  const byKey = new Map<string, number>();
  const link = (key: string | undefined, i: number) => {
    if (!key) return;
    const seen = byKey.get(key);
    if (seen === undefined) byKey.set(key, i);
    else union(seen, i);
  };
  sources.forEach((s, i) => {
    link("n:" + norm(s.name), i);
    const host = apart.has(norm(s.name)) ? undefined : rootHost(s.website);
    if (host) link("h:" + host, i);
  });
  for (const [name, others] of Object.entries(aliases)) {
    const first = byKey.get("n:" + norm(name));
    for (const o of others) {
      const idx = byKey.get("n:" + norm(o));
      if (first !== undefined && idx !== undefined) union(first, idx);
    }
  }

  const groups = new Map<number, Source[]>();
  sources.forEach((s, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), s]));

  const used = new Set<string>();
  const orgs: Org[] = [];
  for (const group of groups.values()) {
    const names = new Set(group.map((g) => norm(g.name)));
    if (names.size > 1) console.log("merged:", [...new Set(group.map((g) => `${g.name} (${g.program})`))].join("  +  "));

    // Prefer the GSoC record for descriptive fields: it is the richest.
    const ranked = [...group].sort((a, b) => (b.program === "gsoc" ? 1 : 0) - (a.program === "gsoc" ? 1 : 0) || b.asOf - a.asOf);
    const lead = ranked[0];
    const pick = <K extends keyof Source>(k: K) => ranked.map((r) => r[k]).find((v) => (Array.isArray(v) ? v.length : Boolean(v)));

    let id = slugify(lead.name) || "org";
    for (let n = 2; used.has(id); n++) id = `${slugify(lead.name)}-${n}`;
    used.add(id);

    const participation: Org["participation"] = {};
    for (const g of group) {
      const into = (participation[g.program] ??= {});
      for (const [y, v] of Object.entries(g.years)) {
        const cur = into[Number(y)];
        into[Number(y)] = cur ? { projects: (cur.projects ?? 0) + (v.projects ?? 0), list: [...cur.list, ...v.list] } : v;
      }
    }

    orgs.push({
      id,
      name: lead.name,
      website: pick("website") as string | undefined,
      tagline: pick("tagline") as string | undefined,
      description: pick("description") as string | undefined,
      logo: pick("logo") as string | undefined,
      license: pick("license") as string | undefined,
      source: pick("source") as string | undefined,
      ideas: pick("ideas") as string | undefined,
      contact: pick("contact") as string | undefined,
      categories: (pick("categories") as string[] | undefined) ?? [],
      topics: (pick("topics") as string[] | undefined) ?? [],
      tech: (pick("tech") as string[] | undefined) ?? [],
      participation,
    });
  }
  return orgs.sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  const [g, l, o, m] = await Promise.all([gsoc(), lfx(), outreachy(), manual()]);
  const b = await sob();
  const orgs = merge([...g.sources, ...l.sources, ...o.sources, ...b.sources, ...m.sources], m.aliases, m.separate);

  // Per-program, per-year totals. Manual programs get theirs from the org rows.
  const stats: Record<string, Record<number, { orgs: number; projects: number | null }>> = { gsoc: g.years, lfx: l.years, outreachy: o.years, sob: b.years };
  for (const s of m.sources) {
    const into = (stats[s.program] ??= {});
    for (const [y, v] of Object.entries(s.years)) {
      const cur = (into[Number(y)] ??= { orgs: 0, projects: 0 });
      cur.orgs++;
      cur.projects = cur.projects === null || v.projects === null ? null : cur.projects + v.projects;
    }
  }

  await mkdir(path.dirname(OUT), { recursive: true });
  const json = JSON.stringify({ generatedAt: new Date().toISOString(), stats, orgs });
  await writeFile(OUT, json);
  console.log(`\nWrote ${orgs.length} organizations, ${(json.length / 1024 / 1024).toFixed(2)} MB → ${path.relative(process.cwd(), OUT)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
