import { supabaseAdmin } from "./supabase";

const API =
  "https://www.info-financiere.gouv.fr/api/explore/v2.0/catalog/datasets/flux-amf-new-prod/records";
const PAGE_SIZE = 100; // maximum accepté par l'API
const MAX_OFFSET = 10_000; // limite OpenDataSoft : offset + limit <= 10000

type SourceFields = Record<string, string | null | undefined>;

export type PublicationRow = {
  source_id: string;
  published_at: string;
  company_name: string;
  isin: string | null;
  lei: string | null;
  country: string | null;
  title: string | null;
  info_type: string | null;
  info_subtype: string | null;
  language: string | null;
  doc_url: string | null;
  is_cac40: boolean;
  raw: SourceFields;
};

const clean = (v?: string | null) => v?.trim() || null;

export function normalize(f: SourceFields): PublicationRow | null {
  const source_id = clean(f.uin_idt_uin);
  const published_at = clean(f.uin_dat_amf);
  if (!source_id || !published_at) return null;
  return {
    source_id,
    published_at,
    company_name: clean(f.identificationsociete_iso_nom_soc) ?? "Société inconnue",
    isin: clean(f.identificationsociete_iso_cd_isi),
    lei: clean(f.identificationsociete_iso_cd_lei),
    country: clean(f.identificationsociete_iso_pay_ss)?.toUpperCase() ?? null,
    title: clean(f.informationdeposee_inf_tit_inf),
    info_type: clean(f.type_d_information),
    info_subtype: clean(f.sous_type_d_information),
    language: clean(f.informationdeposee_inf_lng_inf),
    doc_url: clean(f.url_de_recuperation),
    is_cac40: f.cac40 === "1",
    raw: f,
  };
}

async function fetchSince(since: string): Promise<SourceFields[]> {
  const out: SourceFields[] = [];
  for (let offset = 0; offset + PAGE_SIZE <= MAX_OFFSET; offset += PAGE_SIZE) {
    const url = new URL(API);
    url.searchParams.set("where", `uin_dat_amf >= date'${since}'`);
    url.searchParams.set("order_by", "uin_dat_amf desc");
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("offset", String(offset));
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`API info-financière ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { records: { record: { fields: SourceFields } }[] };
    out.push(...json.records.map((r) => r.record.fields));
    if (json.records.length < PAGE_SIZE) break;
  }
  return out;
}

export async function ingest(days: number) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const fetched = await fetchSince(since);

  // Dédoublonnage dans le lot (un upsert échoue si deux lignes ont la même clé)
  const byId = new Map<string, PublicationRow>();
  let skipped = 0;
  for (const f of fetched) {
    const row = normalize(f);
    if (row) byId.set(row.source_id, row);
    else skipped++;
  }
  const rows = [...byId.values()];

  const db = supabaseAdmin();
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db
      .from("publications")
      .upsert(rows.slice(i, i + 500), { onConflict: "source_id" });
    if (error) throw new Error(`Supabase: ${error.message}`);
  }
  return {
    since,
    fetched: fetched.length,
    upserted: rows.length,
    duplicatesInSource: fetched.length - skipped - rows.length,
    skipped,
  };
}
