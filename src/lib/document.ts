import { extractText, getDocumentProxy } from "unpdf";

export type DocumentText =
  | { ok: true; text: string }
  | { ok: false; reason: string };

const MIN_CHARS = 200; // en dessous, le PDF est probablement scanné (images sans couche texte)

export async function fetchDocumentText(url: string): Promise<DocumentText> {
  if (!/\.pdf(\?|$)/i.test(url)) {
    return { ok: false, reason: "Format non pris en charge (ZIP ou autre, seul le PDF est lu)" };
  }
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return { ok: false, reason: `Téléchargement impossible (HTTP ${res.status})` };
  try {
    const pdf = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()));
    const { text } = await extractText(pdf, { mergePages: true });
    if (text.trim().length < MIN_CHARS) {
      return { ok: false, reason: "Peu ou pas de texte extractible (PDF probablement scanné)" };
    }
    return { ok: true, text };
  } catch (e) {
    return { ok: false, reason: `Lecture du PDF impossible : ${(e as Error).message}` };
  }
}
