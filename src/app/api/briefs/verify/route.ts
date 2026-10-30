import { verifyStoredBriefs } from "@/lib/briefs";

export const maxDuration = 120;

// GET /api/briefs/verify — revérifie les chiffres de toutes les brèves stockées
export async function GET() {
  try {
    return Response.json(await verifyStoredBriefs());
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
