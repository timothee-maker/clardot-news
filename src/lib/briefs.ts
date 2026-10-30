import { fetchDocumentText } from "./document";
import { generateBrief, MODEL, wordCount } from "./llm";
import { listRecent } from "./publications";
import { select } from "./scoring";
import { supabaseAdmin } from "./supabase";

const MIN_WORDS = 100;
const MAX_WORDS = 150;
const distance = (w: number) => Math.max(MIN_WORDS - w, w - MAX_WORDS, 0);

export type GenerationResult = {
  publication_id: number;
  company: string;
  status: "created" | "exists" | "skipped" | "error";
  detail?: string;
  words?: number;
};

// Génère une brève pour chacune des n publications les mieux notées (sans régénérer l'existant).
// dryRun : ne rien écrire en base, renvoyer les brèves pour inspection.
export async function generateTopBriefs(n: number, dryRun = false) {
  const db = supabaseAdmin();
  const top = select(await listRecent(), n);
  const results: (GenerationResult & { brief?: unknown })[] = [];

  for (const pub of top) {
    const base = { publication_id: pub.id, company: pub.company_name };

    if (!dryRun) {
      const { data } = await db.from("briefs").select("id").eq("publication_id", pub.id).maybeSingle();
      if (data) {
        results.push({ ...base, status: "exists" });
        continue;
      }
    }

    if (!pub.doc_url) {
      results.push({ ...base, status: "skipped", detail: "Pas de document" });
      continue;
    }
    const doc = await fetchDocumentText(pub.doc_url);
    if (!doc.ok) {
      results.push({ ...base, status: "skipped", detail: doc.reason });
      continue;
    }

    try {
      const input = {
        company: pub.company_name,
        title: pub.title ?? "",
        publishedAt: pub.published_at,
        text: doc.text,
      };
      let brief = await generateBrief(input);
      let words = wordCount(brief.body);
      if (words < MIN_WORDS || words > MAX_WORDS) {
        // Le modèle respecte mal les longueurs : une seconde tentative avec le décompte réel.
        const retry = await generateBrief({
          ...input,
          feedback: `Le corps précédent faisait ${words} mots. Réécris-le entre ${MIN_WORDS} et ${MAX_WORDS} mots, en gardant les chiffres les plus importants.`,
        });
        const w2 = wordCount(retry.body);
        // On garde la version la plus proche de la fourchette.
        if (distance(w2) < distance(words)) {
          brief = retry;
          words = w2;
        }
      }
      if (dryRun) {
        results.push({ ...base, status: "created", words, brief });
        continue;
      }
      const { error } = await db.from("briefs").insert({
        publication_id: pub.id,
        title: brief.title,
        body: brief.body,
        figures: brief.figures,
        word_count: words,
        model: MODEL,
        source_chars: doc.text.length,
      });
      if (error) throw new Error(error.message);
      results.push({ ...base, status: "created", words });
    } catch (e) {
      results.push({ ...base, status: "error", detail: (e as Error).message });
    }
  }
  return results;
}
