/**
 * Repo line colors. Validated with the dataviz palette checker (CVD separation,
 * lightness band, chroma) against the light and dark panel surfaces.
 * Order is fixed; a repo keeps its slot forever.
 */
export const LINE_COLORS = {
  light: ["#2559D9", "#E8682A", "#0E9F74", "#B88200", "#D2478F", "#4E7F0E", "#5346B8", "#C8372D"],
  dark: ["#4F80F0", "#DD6930", "#1A9C74", "#B88508", "#CF5590", "#6E9E2A", "#7A6DE0", "#E0564B"],
};

export const LINE_NAMES = ["Cobalt", "Tangerine", "Jade", "Saffron", "Magenta", "Fern", "Indigo", "Signal"];

/** CSS custom property for a line color; resolves per theme. */
export const lineVar = (index: number) => `var(--line-${index % 8})`;

/** Whichever of white or ink reads better on a line color, per theme. */
export const onLineVar = (index: number) => `var(--on-line-${index % 8})`;

export function suggestCode(name: string, taken: string[]): string {
  const clean = name.replace(/[^a-zA-Z0-9]/g, " ").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const candidates = [
    words.length > 1 ? words[0][0] + words[1][0] : clean.slice(0, 2),
    clean.slice(0, 1) + (clean.match(/[bcdfghjklmnpqrstvwxyz]/gi)?.[1] ?? clean.slice(-1)),
    clean.slice(0, 1) + clean.slice(-1),
  ];
  for (const c of candidates) {
    const code = c.toUpperCase();
    if (code.length === 2 && !taken.includes(code)) return code;
  }
  for (let i = 0; i < 26; i++) {
    const code = (clean[0] + String.fromCharCode(65 + i)).toUpperCase();
    if (!taken.includes(code)) return code;
  }
  return "XX";
}
