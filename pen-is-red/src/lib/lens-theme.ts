export interface LensTheme {
  primary: string;
  ring: string;
  label: string;
  shortLabel: string;
  badgeClass: string;
}

// Keys are alphabetically sorted segments joined with "+", matching
// what computeLens() in analysis-form.tsx produces via .sort().join("+").
// Sort order: blue_team < philosophical < red_team < symbolic
export const LENS_THEMES: Record<string, LensTheme> = {
  // ── Single lenses ──────────────────────────────────────────────────────────
  red_team: {
    primary: "355 85% 45%",
    ring: "355 85% 45%",
    label: "Red Team",
    shortLabel: "Red",
    badgeClass: "text-red-500 border-red-500/30 bg-red-500/10",
  },
  blue_team: {
    primary: "217 90% 55%",
    ring: "217 90% 55%",
    label: "Blue Team",
    shortLabel: "Blue",
    badgeClass: "text-blue-500 border-blue-500/30 bg-blue-500/10",
  },
  symbolic: {
    primary: "45 90% 50%",
    ring: "45 90% 50%",
    label: "Symbolic",
    shortLabel: "Symbolic",
    badgeClass: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  },
  philosophical: {
    primary: "270 70% 60%",
    ring: "270 70% 60%",
    label: "Philosophical",
    shortLabel: "Philos.",
    badgeClass: "text-violet-500 border-violet-500/30 bg-violet-500/10",
  },

  // ── 2-way combos (keys sorted: b < p < r < s) ──────────────────────────────
  // blue_team + red_team
  "blue_team+red_team": {
    primary: "310 80% 52%",
    ring: "310 80% 52%",
    label: "Red + Blue Team",
    shortLabel: "Red+Blue",
    badgeClass: "text-fuchsia-500 border-fuchsia-500/30 bg-fuchsia-500/10",
  },
  // blue_team + symbolic
  "blue_team+symbolic": {
    primary: "168 72% 45%",
    ring: "168 72% 45%",
    label: "Blue Team + Symbolic",
    shortLabel: "Blue+Sym.",
    badgeClass: "text-teal-500 border-teal-500/30 bg-teal-500/10",
  },
  // blue_team + philosophical
  "blue_team+philosophical": {
    primary: "245 80% 60%",
    ring: "245 80% 60%",
    label: "Blue Team + Philosophical",
    shortLabel: "Blue+Phil.",
    badgeClass: "text-indigo-500 border-indigo-500/30 bg-indigo-500/10",
  },
  // philosophical + red_team
  "philosophical+red_team": {
    primary: "325 78% 52%",
    ring: "325 78% 52%",
    label: "Red Team + Philosophical",
    shortLabel: "Red+Phil.",
    badgeClass: "text-pink-500 border-pink-500/30 bg-pink-500/10",
  },
  // philosophical + symbolic
  "philosophical+symbolic": {
    primary: "55 85% 48%",
    ring: "55 85% 48%",
    label: "Symbolic + Philosophical",
    shortLabel: "Sym.+Phil.",
    badgeClass: "text-yellow-500 border-yellow-500/30 bg-yellow-500/10",
  },
  // red_team + symbolic
  "red_team+symbolic": {
    primary: "20 90% 52%",
    ring: "20 90% 52%",
    label: "Red Team + Symbolic",
    shortLabel: "Red+Sym.",
    badgeClass: "text-orange-500 border-orange-500/30 bg-orange-500/10",
  },

  // ── 3-way combos ───────────────────────────────────────────────────────────
  // blue_team + red_team + symbolic
  "blue_team+red_team+symbolic": {
    primary: "195 80% 50%",
    ring: "195 80% 50%",
    label: "Red + Blue + Symbolic",
    shortLabel: "3-way",
    badgeClass: "text-cyan-500 border-cyan-500/30 bg-cyan-500/10",
  },
  // blue_team + philosophical + red_team
  "blue_team+philosophical+red_team": {
    primary: "280 75% 55%",
    ring: "280 75% 55%",
    label: "Red + Blue + Philosophical",
    shortLabel: "3-way",
    badgeClass: "text-purple-400 border-purple-400/30 bg-purple-400/10",
  },
  // philosophical + red_team + symbolic
  "philosophical+red_team+symbolic": {
    primary: "28 88% 52%",
    ring: "28 88% 52%",
    label: "Red + Symbolic + Philosophical",
    shortLabel: "3-way",
    badgeClass: "text-orange-400 border-orange-400/30 bg-orange-400/10",
  },
  // blue_team + philosophical + symbolic
  "blue_team+philosophical+symbolic": {
    primary: "200 75% 52%",
    ring: "200 75% 52%",
    label: "Blue + Symbolic + Philosophical",
    shortLabel: "3-way",
    badgeClass: "text-sky-500 border-sky-500/30 bg-sky-500/10",
  },

  // ── 4-way combo ────────────────────────────────────────────────────────────
  // blue_team + philosophical + red_team + symbolic
  "blue_team+philosophical+red_team+symbolic": {
    primary: "220 70% 55%",
    ring: "220 70% 55%",
    label: "Full Spectrum",
    shortLabel: "Full",
    badgeClass: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  },

  // ── Auto-detect (resolved server-side before storage) ──────────────────────
  auto: {
    primary: "240 5% 55%",
    ring: "240 5% 55%",
    label: "Auto-detect",
    shortLabel: "Auto",
    badgeClass: "text-slate-400 border-slate-400/30 bg-slate-400/10",
  },

  // ── Code lenses ────────────────────────────────────────────────────────────
  code_python: {
    primary: "207 72% 52%",
    ring: "207 72% 52%",
    label: "Python Code",
    shortLabel: "Python",
    badgeClass: "text-sky-500 border-sky-500/30 bg-sky-500/10",
  },
  code_json: {
    primary: "142 65% 45%",
    ring: "142 65% 45%",
    label: "JSON",
    shortLabel: "JSON",
    badgeClass: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10",
  },
  code_yaml: {
    primary: "32 90% 55%",
    ring: "32 90% 55%",
    label: "YAML",
    shortLabel: "YAML",
    badgeClass: "text-amber-500 border-amber-500/30 bg-amber-500/10",
  },
  code_html: {
    primary: "19 90% 55%",
    ring: "19 90% 55%",
    label: "HTML",
    shortLabel: "HTML",
    badgeClass: "text-orange-500 border-orange-500/30 bg-orange-500/10",
  },
};

const DEFAULT_THEME = LENS_THEMES["red_team"];

export function getLensTheme(lens: string): LensTheme {
  if (!lens) return DEFAULT_THEME;
  // Normalise: sort segments alphabetically — matches computeLens() encoding
  const normalised = lens
    .split("+")
    .map((s) => s.trim())
    .sort()
    .join("+");
  return LENS_THEMES[normalised] ?? DEFAULT_THEME;
}

export function applyLensTheme(lens: string): void {
  const theme = getLensTheme(lens);
  const root = document.documentElement;
  root.style.setProperty("--primary", theme.primary);
  root.style.setProperty("--ring", theme.ring);
  root.style.setProperty("--sidebar-primary", theme.primary);
  root.style.setProperty("--sidebar-ring", theme.ring);
  root.style.setProperty("--accent", theme.primary);
}
