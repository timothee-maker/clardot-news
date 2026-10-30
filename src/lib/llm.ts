import { GoogleGenAI, Type } from "@google/genai";

// Seul fichier qui connaît le fournisseur de LLM : changer de modèle = changer ce fichier.
export const MODEL = "gemini-3.5-flash";
const MAX_SOURCE_CHARS = 60_000;

export type BriefInput = {
  company: string;
  title: string;
  publishedAt: string;
  text: string;
  feedback?: string; // consigne de correction pour une seconde tentative
};
export type BriefOutput = { title: string; body: string; figures: string[] };

const SYSTEM = `Tu es journaliste financier. Tu rédiges une brève d'actualité en français à partir d'un document réglementé.
Règles strictes :
- Utilise UNIQUEMENT les informations présentes dans le document fourni. N'invente rien, n'ajoute aucun contexte extérieur.
- Corps de la brève : entre 100 et 150 mots, style factuel, sans adjectifs promotionnels.
- Cite les chiffres clés exactement comme ils figurent dans le document (même valeur, même unité). Ne calcule pas de nouveau chiffre, n'arrondis pas.
- Si le document ne contient pas de chiffre, n'en mets pas.
- Dans "figures", liste chaque chiffre cité dans le corps, tel qu'écrit dans le corps (ex. "457,2 M€", "+13,5 %").
- Le titre est informatif, 12 mots maximum.`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function generateBrief(input: BriefInput): Promise<BriefOutput> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  // Le modèle est parfois surchargé (503) : on réessaie avec un délai croissant.
  for (let attempt = 1; ; attempt++) {
    try {
      return await call(ai, input);
    } catch (e) {
      // Seule la surcharge (503) est passagère : un quota épuisé (429) ou des crédits vides (402) ne se règlent pas en attendant.
      const transient = /\b503\b|UNAVAILABLE/.test((e as Error).message);
      if (!transient || attempt === 5) throw e;
      await sleep(attempt * 6000);
    }
  }
}

async function call(ai: GoogleGenAI, input: BriefInput): Promise<BriefOutput> {
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: `Société : ${input.company}
Titre de la publication : ${input.title}
Date : ${input.publishedAt}

Document :
"""
${input.text.slice(0, MAX_SOURCE_CHARS)}
"""${input.feedback ? `\n\nCorrection demandée : ${input.feedback}` : ""}`,
    config: {
      systemInstruction: SYSTEM,
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          body: { type: Type.STRING },
          figures: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["title", "body", "figures"],
      },
    },
  });
  return JSON.parse(res.text ?? "") as BriefOutput;
}

export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
