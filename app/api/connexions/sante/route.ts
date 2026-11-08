import { NextResponse } from "next/server";
import { db, isDemo } from "@/lib/store";
import { cmDiagnostic, cmJeton } from "@/lib/cm";
import { statsStockage } from "@/lib/mediatheque";
import { aiProvider } from "@/lib/claude";
import type { Platform } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Res = Record<string, { ok?: boolean; at?: string; detail?: string } | undefined>;
type Ligne = { id: string; title: string | null; idea: string | null; scheduled_at: string | null; created_at: string; results: Res | null };

// GET /api/connexions/sante → état de santé des comptes : dernières publications réussies, incidents,
// jeton Facebook (date d'expiration et autorisations, jamais le jeton), stockage. Aucun secret renvoyé.
export async function GET() {
  if (isDemo()) return NextResponse.json({ demo: true });
  const depuis = new Date(Date.now() - 14 * 864e5).toISOString();
  const [posts, jeton, diag, stockage] = await Promise.all([
    db().from("posts").select("id,title,idea,scheduled_at,created_at,results").not("results", "is", null).gte("created_at", depuis).order("created_at", { ascending: false }).limit(400),
    cmJeton().catch(() => null),
    cmDiagnostic().catch(() => []),
    statsStockage().catch(() => null),
  ]);
  const plateformes: Platform[] = ["facebook", "linkedin", "wordpress", "tiktok"];
  const dernier: Partial<Record<Platform, string>> = {};
  const incidents: { plateforme: Platform; at: string; detail: string; titre: string; id: string; resolu: boolean }[] = [];
  for (const p of (posts.data ?? []) as Ligne[]) {
    for (const pf of plateformes) {
      const r = p.results?.[pf];
      if (!r) continue;
      const at = r.at ?? p.scheduled_at ?? p.created_at;
      if (r.ok) {
        if (!dernier[pf] || at > (dernier[pf] as string)) dernier[pf] = at;
      } else {
        incidents.push({ plateforme: pf, at, detail: r.detail ?? "Échec sans détail", titre: p.title || p.idea || "Publication", id: p.id, resolu: false });
      }
    }
  }
  // Un incident est « résolu » si la plateforme a publié avec succès après lui.
  for (const i of incidents) i.resolu = Boolean(dernier[i.plateforme] && (dernier[i.plateforme] as string) > i.at);
  incidents.sort((a, b) => b.at.localeCompare(a.at));
  return NextResponse.json({
    dernier,
    incidents: incidents.slice(0, 40),
    jeton,
    diagnostic: diag,
    stockage,
    ia: aiProvider(),
    voix: Boolean(process.env.GEMINI_API_KEY),
  });
}
