import { generateTopBriefs } from "@/lib/briefs";

export const maxDuration = 300;

// GET /api/briefs?n=5&dry=1 — génère (ou simule avec dry=1) les brèves du top n
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const n = Math.min(Math.max(Number(sp.get("n")) || 5, 1), 5);
  try {
    return Response.json(await generateTopBriefs(n, sp.get("dry") === "1"));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
