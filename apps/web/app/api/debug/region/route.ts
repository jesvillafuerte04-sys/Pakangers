// TEMPORARY diagnostic: reports which region this function actually runs in,
// and how long a single Supabase round trip takes from there. Used to verify
// the Vercel function region matches the database region. Safe to delete.
import { getServiceSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getServiceSupabase();

  const t0 = Date.now();
  await supabase.from("tournament").select("id").limit(1);
  const oneQueryMs = Date.now() - t0;

  const t1 = Date.now();
  for (let i = 0; i < 5; i++) {
    await supabase.from("tournament").select("id").limit(1);
  }
  const fiveSequentialMs = Date.now() - t1;

  return Response.json({
    vercelRegion: process.env.VERCEL_REGION ?? "unknown",
    oneQueryMs,
    fiveSequentialMs,
    avgPerQueryMs: Math.round(fiveSequentialMs / 5),
  });
}
