// Score de « newsworthiness » transparent, par règles. Chaque règle a un libellé et des points :
// la raison d'une sélection est la liste des règles déclenchées (affichée dans l'UI).

export type Scorable = {
  title: string | null;
  info_subtype: string | null;
  is_cac40: boolean;
};

export type Reason = { label: string; points: number };
export type Scored = { score: number; reasons: Reason[] };

type Rule = { label: string; points: number; test: (p: Scorable, text: string) => boolean };

const has = (re: RegExp) => (_: Scorable, text: string) => re.test(text);
const subtype = (re: RegExp) => (p: Scorable) => re.test(p.info_subtype ?? "");

export const MIN_SCORE = 40;

export const RULES: Rule[] = [
  // --- Signaux forts : un fait nouveau, chiffré ou structurant
  {
    label: "Résultats / chiffre d'affaires",
    points: 30,
    test: has(/résultats?(?! de l.offre)|results|chiffre d.affaires|revenues?\b|sales\b|turnover|résultat net|ebitda|net income|bénéfice|profit/i),
  },
  {
    label: "Offre publique (OPA/OPE)",
    points: 40,
    test: (p, t) =>
      /offre publique|takeover|tender offer|\bopa\b|\bope\b|\bopas\b/i.test(t) ||
      /offre publique/i.test(p.info_subtype ?? ""),
  },
  {
    label: "Opération de capital (augmentation, émission)",
    points: 30,
    test: has(/augmentation de capital|capital increase|émission d|issuance|oceane|obligations convertibles|convertible bonds|placement privé/i),
  },
  {
    label: "Acquisition / cession / accord stratégique",
    points: 25,
    test: has(/acqui(si|re)|acquisition|cession|disposal|divest|merger|fusion|rapprochement|partnership|partenariat|\baccord\b|agreement|wins contract|remporte|contrat/i),
  },
  {
    label: "Guidance / objectifs relevés ou confirmés",
    points: 20,
    test: has(/guidance|objectifs?\b|targets?\b|perspectives|outlook|relève|raised|upgraded|confirm/i),
  },
  {
    label: "Gouvernance (nomination, départ)",
    points: 25,
    test: has(/gouvernance|governance|nomination|nomme|appointed|directeur général|chief executive|\bceo\b|démission|resign|succeed/i),
  },
  {
    label: "Alerte (dépréciation, litige, avertissement)",
    points: 25,
    test: has(/profit warning|avertissement|dépréciation|impairment|litige|enquête|investigation|redressement|sauvegarde|insolvency/i),
  },
  // --- Types de publication peu informatifs
  {
    label: "Information trimestrielle",
    points: 10,
    test: subtype(/trimestrielle/i),
  },
  // --- Malus : publications routinières
  {
    label: "Droits de vote / capital (routine)",
    points: -60,
    test: (p, t) =>
      /droits de vote|voting rights|share capital and voting/i.test(t) ||
      /nombre total de droits de vote/i.test(p.info_subtype ?? ""),
  },
  {
    label: "Rachat d'actions propres (routine)",
    points: -40,
    test: (p, t) =>
      /rachat|buyback|actions propres|own shares|déclaration hebdomadaire|weekly declaration|liquidity contract|contrat de liquidité/i.test(t) ||
      /acquisition ou cession des actions de l.émetteur/i.test(p.info_subtype ?? ""),
  },
  {
    label: "Mise à disposition de documents (formel)",
    points: -30,
    test: (p, t) =>
      /mise à disposition|modalités de mise|availability|preparatory documents|available to the public/i.test(t) ||
      /mise à disposition/i.test(p.info_subtype ?? ""),
  },
  {
    label: "Calendrier / report de publication",
    points: -20,
    test: has(/report de la publication|publication of the .* results on|calendrier financier|financial calendar|date de publication/i),
  },
  {
    label: "Honoraires des contrôleurs légaux",
    points: -50,
    test: has(/honoraires|auditors.? fees/i),
  },
  // --- Bonus de contexte
  {
    label: "Société du CAC 40",
    points: 20,
    test: (p) => p.is_cac40,
  },
  {
    label: "Chiffres dans le titre (%, M€, Md€…)",
    points: 10,
    test: has(/\d+([.,]\d+)?\s?(%|m€|md€|m eur|€|eur|millions?|billions?|m\b|bn\b)|(€|eur|\$)\s?\d/i),
  },
];

export function score(p: Scorable): Scored {
  const text = p.title ?? "";
  const reasons: Reason[] = [];
  for (const r of RULES) {
    if (r.test(p, text)) reasons.push({ label: r.label, points: r.points });
  }
  return { score: reasons.reduce((s, r) => s + r.points, 0), reasons };
}

// --- Sélection : top N, après regroupement des jumeaux FR/EN et un seul article par société.

export type Selectable = Scorable & {
  id: number;
  company_name: string;
  published_at: string;
  language: string | null;
};

export function select<T extends Selectable>(rows: T[], n = 5): (T & Scored)[] {
  const scored = rows
    .map((r) => ({ ...r, ...score(r) }))
    .filter((r) => r.score >= MIN_SCORE)
    // Meilleur score d'abord ; à score égal, version française puis la plus récente.
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.language === "Français") - Number(a.language === "Français") ||
        b.published_at.localeCompare(a.published_at),
    );

  const seen = new Set<string>();
  const out: (T & Scored)[] = [];
  for (const r of scored) {
    if (seen.has(r.company_name)) continue; // jumeau FR/EN ou autre publication de la même société
    seen.add(r.company_name);
    out.push(r);
    if (out.length === n) break;
  }
  return out;
}
