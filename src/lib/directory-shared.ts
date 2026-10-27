/**
 * Types and pure helpers for the program directory. Nothing here touches the
 * data file, so client components can import it freely.
 */

export const DIRECTORY_PROGRAMS = ["gsoc", "lfx", "sob", "outreachy"] as const;
export type DirProgram = (typeof DIRECTORY_PROGRAMS)[number];

export const isDirProgram = (id: string): id is DirProgram => (DIRECTORY_PROGRAMS as readonly string[]).includes(id);

export type DirProject = { title: string; tech: string[]; url?: string };
export type DirYear = { projects: number | null; list: DirProject[] };

/** One organization as written by scripts/build-directory.ts. */
export type DirOrgRaw = {
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
  participation: Partial<Record<DirProgram, Record<string, DirYear>>>;
};

export type DirFile = {
  generatedAt: string;
  stats: Partial<Record<DirProgram, Record<string, { orgs: number; projects: number | null }>>>;
  orgs: DirOrgRaw[];
};

/** Short names for chips and plates. */
export const DIR_PROGRAM_LABEL: Record<DirProgram, string> = {
  gsoc: "GSoC",
  lfx: "LFX",
  sob: "SoB",
  outreachy: "Outreachy",
};

/** What the dataset counts as an "organization" in each program. */
export const DIR_ORG_NOUN: Record<DirProgram, string> = {
  gsoc: "organizations",
  lfx: "foundations and projects",
  sob: "organizations",
  outreachy: "communities",
};

/** What a project count means in each program, so the numbers are not over-read. */
export const DIR_PROJECT_NOTE: Record<DirProgram, string> = {
  gsoc: "Completed projects from Google’s archive. The current year lists announced organizations only.",
  lfx: "Mentorship projects whose term started that year, under the LF foundation that hosts them.",
  sob: "Projects as listed on the Summer of Bitcoin site, grouped by the organization named there.",
  outreachy: "Internship projects across that year’s rounds, grouped by community.",
};

// ---------- how regularly an organization shows up ----------

export type CadenceKey = "every-year" | "most-years" | "on-and-off" | "occasional" | "returning" | "new" | "once" | "lapsed";

export type Cadence = {
  key: CadenceKey;
  label: string;
  /** One line that says what the label means for this organization. */
  detail: string;
  tone: "good" | "mid" | "quiet" | "new";
};

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

/**
 * Classifies an organization by how often it turned up since it first did.
 * `latest` is the newest cycle that counts as complete data for the program.
 */
export function cadenceOf(years: number[], latest: number): Cadence {
  if (!years.length) return { key: "once", label: "No record", detail: "No participation on record.", tone: "quiet" };
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted.at(-1)!;
  const top = Math.max(latest, last);
  const span = top - first + 1;
  const n = sorted.length;
  const of = `${n} of ${plural(span, "year")} since ${first}`;

  if (top - last >= 3) return { key: "lapsed", label: "Lapsed", detail: `${of}. Last seen in ${last}.`, tone: "quiet" };
  if (n === 1) {
    return first === top
      ? { key: "new", label: "New", detail: `First appearance, in ${first}.`, tone: "new" }
      : { key: "once", label: "Once", detail: `Appeared once, in ${first}.`, tone: "quiet" };
  }
  const rate = n / span;
  if (rate === 1) {
    return n >= 3
      ? { key: "every-year", label: "Every year", detail: `${of}, with no gaps.`, tone: "good" }
      : { key: "returning", label: "Back again", detail: `${of}.`, tone: "new" };
  }
  if (rate >= 0.7) return { key: "most-years", label: "Most years", detail: `${of}.`, tone: "good" };
  if (rate >= 0.4) return { key: "on-and-off", label: "On and off", detail: `${of}.`, tone: "mid" };
  return { key: "occasional", label: "Occasional", detail: `${of}.`, tone: "quiet" };
}

export const CADENCE_ORDER: CadenceKey[] = ["every-year", "most-years", "returning", "new", "on-and-off", "occasional", "once", "lapsed"];

export const CADENCE_LABEL: Record<CadenceKey, string> = {
  "every-year": "Every year",
  "most-years": "Most years",
  returning: "Back again",
  new: "New",
  "on-and-off": "On and off",
  occasional: "Occasional",
  once: "Once",
  lapsed: "Lapsed",
};

export const CADENCE_TONE: Record<CadenceKey, Cadence["tone"]> = {
  "every-year": "good",
  "most-years": "good",
  returning: "new",
  new: "new",
  "on-and-off": "mid",
  occasional: "quiet",
  once: "quiet",
  lapsed: "quiet",
};

// ---------- tech labels ----------

const TECH_LABELS: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  "node.js": "Node.js",
  "c++": "C++",
  "c#": "C#",
  php: "PHP",
  sql: "SQL",
  html: "HTML",
  css: "CSS",
  html5: "HTML5",
  css3: "CSS3",
  api: "API",
  rest: "REST",
  graphql: "GraphQL",
  ios: "iOS",
  android: "Android",
  linux: "Linux",
  macos: "macOS",
  aws: "AWS",
  gcp: "GCP",
  llvm: "LLVM",
  gcc: "GCC",
  cuda: "CUDA",
  opengl: "OpenGL",
  webassembly: "WebAssembly",
  wasm: "WASM",
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  mongodb: "MongoDB",
  sqlite: "SQLite",
  kubernetes: "Kubernetes",
  docker: "Docker",
  github: "GitHub",
  gitlab: "GitLab",
  react: "React",
  vue: "Vue",
  angular: "Angular",
  django: "Django",
  flask: "Flask",
  rails: "Rails",
  "ruby on rails": "Rails",
  rust: "Rust",
  go: "Go",
  java: "Java",
  kotlin: "Kotlin",
  swift: "Swift",
  python: "Python",
  ruby: "Ruby",
  perl: "Perl",
  haskell: "Haskell",
  scala: "Scala",
  julia: "Julia",
  lua: "Lua",
  bash: "Bash",
  "machine learning": "Machine learning",
  "artificial intelligence": "Artificial intelligence",
  "deep learning": "Deep learning",
  tensorflow: "TensorFlow",
  pytorch: "PyTorch",
  numpy: "NumPy",
  nlp: "NLP",
  "natural language processing": "Natural language processing",
  "ux research": "UX research",
  ui: "UI",
  ux: "UX",
  "bitcoin p2p": "Bitcoin P2P",
  nostr: "Nostr",
  "tailwind css": "Tailwind CSS",
  "next.js": "Next.js",
  "nginx": "NGINX",
  "ci/cd": "CI/CD",
  devops: "DevOps",
  fpga: "FPGA",
  gpu: "GPU",
  "embedded systems": "Embedded systems",
};

export function techLabel(tag: string): string {
  return TECH_LABELS[tag] ?? tag.charAt(0).toUpperCase() + tag.slice(1);
}

// ---------- a stable color per organization ----------

/** Picks one of the eight line colors from the id, so an org keeps its color everywhere. */
export function orgColorIndex(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 8;
}

/** Two letters for the roundel: initials of the first two words, else the first two letters. */
export function orgCode(name: string): string {
  const words = name
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !/^(the|of|and|for)$/i.test(w));
  const code = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? name).slice(0, 2);
  return code.toUpperCase();
}
