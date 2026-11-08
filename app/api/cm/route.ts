import { NextResponse } from "next/server";
import { cmAimer, cmAnnuler, cmDebutCrise, cmDiagnostic, cmEtat, cmFinCrise, cmMarquerTraite, cmMasquer, cmPassage, cmRapport, cmReformuler, cmRepondre, cmSauverReglages, type CmReglages } from "@/lib/cm";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET → état de l'agent (réglages, à traiter, journal, dernier rapport) ; ?diag=1 → ce que le jeton Facebook permet.
export async function GET(req: Request) {
  try {
    const diag = new URL(req.url).searchParams.get("diag") === "1";
    return NextResponse.json({ ...(await cmEtat()), ...(diag ? { diagnostic: await cmDiagnostic() } : {}) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST → { reglages } | { traite: id } | { lancer: true } | { rapport: true } | { annuler: id } | { finCrise: true }
export async function POST(req: Request) {
  try {
    const b = (await req.json().catch(() => ({}))) as {
      reglages?: Partial<CmReglages>; traite?: string; lancer?: boolean; rapport?: boolean; annuler?: string; finCrise?: boolean;
      repondre?: string; texte?: string; aimer?: string; masquer?: string; reformuler?: string; ton?: string; crise?: string;
    };
    if (b.repondre) return NextResponse.json({ log: [await cmRepondre(b.repondre, b.texte ?? "")] });
    if (b.aimer) return NextResponse.json({ log: [await cmAimer(b.aimer)] });
    if (b.masquer) return NextResponse.json({ log: [await cmMasquer(b.masquer)] });
    if (b.reformuler) return NextResponse.json({ reponse: await cmReformuler(b.reformuler, b.ton ?? "rassurant", b.texte) });
    if (b.crise) return NextResponse.json({ reglages: await cmDebutCrise(b.crise) });
    if (b.annuler) return NextResponse.json({ log: [await cmAnnuler(b.annuler)] });
    if (b.finCrise) return NextResponse.json({ reglages: await cmFinCrise() });
    if (b.reglages) return NextResponse.json({ reglages: await cmSauverReglages(b.reglages) });
    if (b.traite) { await cmMarquerTraite(b.traite); return NextResponse.json({ ok: true }); }
    if (b.lancer) return NextResponse.json({ log: await cmPassage({ force: true }) });
    if (b.rapport) return NextResponse.json({ rapport: await cmRapport() });
    return NextResponse.json({ error: "Requête inconnue." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
