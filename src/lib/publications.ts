import { supabaseAdmin } from "./supabase";

export const PAGE_SIZE = 25;
export const NO_SUBTYPE = "__none__";

export type Filters = { q: string; type: string; from: string; to: string; page: number };

export type Publication = {
  id: number;
  source_id: string;
  published_at: string;
  company_name: string;
  isin: string | null;
  title: string | null;
  info_type: string | null;
  info_subtype: string | null;
  language: string | null;
  doc_url: string | null;
  is_cac40: boolean;
};

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export function parseFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  };
  const from = one("from");
  const to = one("to");
  return {
    q: one("q"),
    type: one("type"),
    from: isDate(from) ? from : "",
    to: isDate(to) ? to : "",
    page: Math.max(1, parseInt(one("page")) || 1),
  };
}

export async function listPublications(f: Filters) {
  let query = supabaseAdmin()
    .from("publications")
    .select(
      "id, source_id, published_at, company_name, isin, title, info_type, info_subtype, language, doc_url, is_cac40",
      { count: "exact" },
    );

  // Les caractères % _ \ sont des jokers de ILIKE : on les échappe.
  if (f.q) query = query.ilike("company_name", `%${f.q.replace(/[\\%_]/g, "\\$&")}%`);
  if (f.type === NO_SUBTYPE) query = query.is("info_subtype", null);
  else if (f.type) query = query.eq("info_subtype", f.type);
  if (f.from) query = query.gte("published_at", parisMidnight(f.from));
  if (f.to) query = query.lt("published_at", parisMidnight(nextDay(f.to)));

  const start = (f.page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .range(start, start + PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as Publication[], total: count ?? 0 };
}

export async function listSubtypes(): Promise<string[]> {
  const { data, error } = await supabaseAdmin()
    .from("publications")
    .select("info_subtype")
    .not("info_subtype", "is", null)
    .limit(10000);
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((r) => r.info_subtype as string))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );
}

function nextDay(d: string) {
  const dt = new Date(`${d}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

// Instant UTC correspondant à 00:00 heure de Paris ce jour-là (gère heure d'été / d'hiver).
function parisMidnight(d: string) {
  const guess = new Date(`${d}T00:00:00Z`);
  const tz = new Intl.DateTimeFormat("en", { timeZone: "Europe/Paris", timeZoneName: "longOffset" })
    .formatToParts(guess)
    .find((p) => p.type === "timeZoneName")!.value; // "GMT+01:00" ou "GMT+02:00"
  const hours = parseInt(tz.slice(3, 6)) || 0;
  return new Date(guess.getTime() - hours * 3_600_000).toISOString();
}
