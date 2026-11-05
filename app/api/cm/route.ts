import { NextResponse } from "next/server";
import { cmDiagnostic, cmEtat, cmMarquerTraite, cmPassage, cmRapport, cmSauverReglages, type CmReglages } from "@/lib/cm";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// GET → état de l'agent (réglages, à traiter, journal, dernier rapport) ; ?diag=1 → ce que le jeton Facebook permet.
export async function GET(req: Request) {
  try {
    const diag = new URL(req.url).searchParams.get("diag") === "1";
    return NextResponse.json({ ...(await cmEtat()), ...(diag ? { diagnostic: await cmDiagnostic() } : {}) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST → { reglages } | { traite: id } | { lancer: true } | { rapport: true }
export async function POST(req: Request) {
  try {
    const b = (await req.json().catch(() => ({}))) as { reglages?: Partial<CmReglages>; traite?: string; lancer?: boolean; rapport?: boolean };
    if (b.reglages) return NextResponse.json({ reglages: await cmSauverReglages(b.reglages) });
    if (b.traite) { await cmMarquerTraite(b.traite); return NextResponse.json({ ok: true }); }
    if (b.lancer) return NextResponse.json({ log: await cmPassage({ force: true }) });
    if (b.rapport) return NextResponse.json({ rapport: await cmRapport() });
    return NextResponse.json({ error: "Requête inconnue." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
