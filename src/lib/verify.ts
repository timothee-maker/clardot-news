// Vérification des chiffres d'une brève contre le texte du document source.
// Approche volontairement simple : on compare des valeurs numériques normalisées, pas du sens.
// Limites (voir README) : le signe / la direction (hausse ou baisse) et le libellé associé au
// chiffre ne sont pas contrôlés ; un chiffre peut exister dans le document avec un autre sens.

export type Status = "ok" | "warn" | "absent";
export type FigureCheck = { text: string; status: Status; note?: string };
export type Verification =
  | {
      checked: true;
      summary: Record<Status, number>;
      items: FigureCheck[];
      sourceChars: number;
    }
  | { checked: false; reason: string };

const MONTHS = "janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre";

// Dates, années et libellés de période : ce ne sont pas des chiffres à vérifier.
const IGNORED = [
  new RegExp(`\\b\\d{1,2}(?:er)?\\s+(?:${MONTHS})(?:\\s+\\d{4})?`, "gi"),
  /\b(?:19|20)\d{2}(?:\s?[-/–]\s?(?:19|20)?\d{2})?\b/g,
  /\bT[1-4]\b|\bS[12]\b|\bH[12]\b|\b[1-4](?:er|e|ème)?\s+(?:trimestre|semestre)/gi,
];

const CHAIN = /\d+(?:[ .,]\d+)*/g;
const PCT_AFTER = /^\)?\s?(?:%|pts?\b|points?\b)/i;

const key = (n: number) => String(Number(n.toPrecision(10)));

const normalizeSpaces = (s: string) => s.replace(/[    ]/g, " ");

// Toutes les valeurs numériques possibles d'une suite de morceaux ("14 444,2" => 14444.2).
// Ambiguïté volontairement conservée : "1,662" peut valoir 1.662 (décimal français) ou 1662 (milliers).
function interpret(pcs: string[], seps: string[]): number[] {
  if (pcs.length === 1) return [Number(pcs[0])];
  const out: number[] = [];
  const k = pcs.length - 1;
  const groupsOk = (g: string[]) => g[0].length <= 3 && g.slice(1).every((p) => p.length === 3);
  if (/[.,]/.test(seps[k - 1]) && (k === 1 || groupsOk(pcs.slice(0, k)))) {
    out.push(Number(`${pcs.slice(0, k).join("")}.${pcs[k]}`));
  }
  if (groupsOk(pcs)) out.push(Number(pcs.join("")));
  return out;
}

type Chain = { pcs: string[]; seps: string[]; end: number; pct: boolean };

function chains(text: string): Chain[] {
  const out: Chain[] = [];
  for (const m of text.matchAll(CHAIN)) {
    const raw = m[0];
    const pcs = raw.split(/[ .,]/);
    const seps = raw.match(/[ .,]/g) ?? [];
    const end = (m.index ?? 0) + raw.length;
    out.push({ pcs, seps, end, pct: PCT_AFTER.test(text.slice(end, end + 12)) });
  }
  return out;
}

function candidates(c: Chain, subChains: boolean): { values: number[]; pct: boolean }[] {
  const res: { values: number[]; pct: boolean }[] = [];
  const maxLen = Math.min(c.pcs.length, 30); // garde-fou sur les lignes de tableaux très longues
  const starts = subChains ? maxLen : 1;
  for (let i = 0; i < starts; i++) {
    for (let j = i; j < maxLen; j++) {
      // Les sous-suites permettent de retrouver "9 530" dans une ligne de tableau "9 530 124".
      if (!subChains && j !== maxLen - 1) continue;
      res.push({
        values: interpret(c.pcs.slice(i, j + 1), c.seps.slice(i, j)),
        pct: c.pct && j === c.pcs.length - 1,
      });
    }
  }
  return res;
}

export function extractSourceNumbers(text: string) {
  const any = new Map<string, number>();
  const pct = new Set<string>();
  for (const c of chains(normalizeSpaces(text))) {
    for (const cand of candidates(c, true)) {
      for (const v of cand.values) {
        if (!Number.isFinite(v)) continue;
        any.set(key(v), v);
        if (cand.pct) pct.add(key(v));
      }
    }
  }
  return { any, pct };
}

type BriefFigure = { text: string; values: number[]; pct: boolean; integerSmall: boolean };

export function extractBriefFigures(body: string): BriefFigure[] {
  let text = normalizeSpaces(body);
  for (const re of IGNORED) text = text.replace(re, (m) => " ".repeat(m.length));
  const out: BriefFigure[] = [];
  for (const m of text.matchAll(/([+\-−–]\s?)?\d+(?:[ .,]\d+)*/g)) {
    const raw = m[0];
    const digits = raw.replace(/^[+\-−–]\s?/, "");
    const start = m.index ?? 0;
    const end = start + raw.length;
    // Libellé affiché : le nombre suivi de son unité ("14 444 millions d'euros", "+8,5 %", "173,8 M€").
    const tail = text
      .slice(end, end + 40)
      .match(/^\s?(?:%|(?:M€|Md€|k€|€|(?:millions?|milliards?)(?:\s+d[’']\p{L}+)?|\p{L}+))/u);
    const c: Chain = {
      pcs: digits.split(/[ .,]/),
      seps: digits.match(/[ .,]/g) ?? [],
      end,
      pct: PCT_AFTER.test(text.slice(end, end + 12)),
    };
    const [{ values }] = candidates(c, false);
    if (values.length === 0) continue;
    out.push({
      text: `${raw}${tail ? tail[0] : ""}`.trim(),
      values,
      pct: c.pct,
      // Entier de 1 ou 2 chiffres sans unité : trop banal pour qu'une simple présence prouve quoi que ce soit.
      integerSmall: !/[.,]/.test(digits) && digits.length <= 2 && !c.pct,
    });
  }
  return out;
}

export function verifyBrief(body: string, sourceText: string): Verification {
  const src = extractSourceNumbers(sourceText);
  const items: FigureCheck[] = extractBriefFigures(body).map((f) => {
    const inPct = f.values.some((v) => src.pct.has(key(v)));
    const inAny = f.values.some((v) => src.any.has(key(v)));

    if (f.pct) {
      if (inPct) return { text: f.text, status: "ok" };
      if (inAny) return { text: f.text, status: "warn", note: "valeur présente dans le document mais pas sous forme de pourcentage" };
    } else if (inAny) {
      if (f.integerSmall) return { text: f.text, status: "warn", note: "nombre trop court : sa présence ne prouve rien" };
      return { text: f.text, status: "ok" };
    }

    // Même nombre exprimé dans une autre unité (11,6 milliards <-> 11 600 millions)
    if (!f.integerSmall && f.values.some((v) => src.any.has(key(v * 1000)) || src.any.has(key(v / 1000)))) {
      return { text: f.text, status: "ok", note: "retrouvé avec une unité convertie (milliers / millions)" };
    }

    // Valeur proche (arrondi, ou chiffre calculé par le modèle)
    let nearest: number | null = null;
    for (const v of f.values) {
      if (v < 100) continue;
      for (const s of src.any.values()) {
        const d = Math.abs(s - v) / v;
        if (s !== v && d <= 0.005 && (nearest === null || d < Math.abs(nearest - v) / v)) nearest = s;
      }
    }
    if (nearest !== null) {
      return { text: f.text, status: "warn", note: `proche de ${nearest} dans le document (arrondi ou calcul ?)` };
    }
    return { text: f.text, status: "absent", note: "absent du document" };
  });

  const summary = { ok: 0, warn: 0, absent: 0 } as Record<Status, number>;
  for (const i of items) summary[i.status]++;
  return { checked: true, summary, items, sourceChars: sourceText.length };
}
