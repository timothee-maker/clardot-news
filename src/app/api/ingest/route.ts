import { ingest } from "@/lib/ingest";

export const maxDuration = 60;

// GET /api/ingest?days=5
export async function GET(request: Request) {
  const days = Math.min(Math.max(Number(new URL(request.url).searchParams.get("days")) || 5, 1), 30);
  try {
    return Response.json(await ingest(days));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
