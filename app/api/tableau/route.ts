import { NextResponse } from "next/server";
import { db, getSettings, isDemo } from "@/lib/store";
import { statsStockage } from "@/lib/mediatheque";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Ligne = {
  id: string; rubrique: string; origin: string; status: string; scheduled_at: string | null; created_at: string;
  source_name: string | null; title: string | null; photo: string | null; results: Record<string, { ok: boolean; detail: string; at: string }> | null;
};

const JOUR = 864e5;
const cle = (d: Date) => d.toISOString().slice(0, 10); // Ouagadougou = UTC

// GET /api/tableau → chiffres du tableau de bord (7 derniers jours + 2 jours planifiés).
export async function GET(req: Request) {
  if (isDemo()) return NextResponse.json({ demo: true });
  try {
    if (new URL(req.url).searchParams.get("leger")) {
      // Menu latéral : état du pilote automatique et messages du Grin à traiter
      const depuis = new Date(Date.now() - 7 * JOUR).toISOString();
      const [s, cm, pub] = await Promise.all([
        getSettings(),
        db().from("cm_journal").select("id", { count: "exact", head: true }).eq("traite", false),
        db().from("posts").select("source_name,source_url").eq("status", "publie").gte("scheduled_at", depuis).not("source_name", "is", null).limit(2000),
      ]);
      const src = new Map<string, number>();
      const dom = new Map<string, string>();
      for (const x of (pub.data ?? []) as { source_name: string; source_url: string | null }[]) {
        src.set(x.source_name, (src.get(x.source_name) ?? 0) + 1);
        if (!dom.has(x.source_name) && x.source_url) { try { dom.set(x.source_name, new URL(x.source_url).hostname.replace(/^www\./, "")); } catch { /* lien invalide */ } }
      }
      const sources = [...src.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([nom, n]) => ({ nom, n, domaine: dom.get(nom) }));
      return NextResponse.json({ autopilot: s.autopilot, grin: { aTraiter: cm.count ?? 0 }, sources });
    }
    const now = new Date();
    const debut = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 6 * JOUR);
    const fin = new Date(debut.getTime() + 9 * JOUR);
    const [p1, p2, reglages, minute, cm, recap, media] = await Promise.all([
      db().from("posts").select("id,rubrique,origin,status,scheduled_at,created_at,source_name,title,photo:visual->>photo,results")
        .gte("scheduled_at", debut.toISOString()).lt("scheduled_at", fin.toISOString()).limit(2000),
      db().from("posts").select("id,rubrique,origin,status,scheduled_at,created_at,source_name,title,photo:visual->>photo,results")
        .is("scheduled_at", null).gte("created_at", debut.toISOString()).limit(2000),
      getSettings(),
      db().from("settings").select("data").eq("id", 5).maybeSingle(),
      db().from("cm_journal").select("id", { count: "exact", head: true }).eq("traite", false),
      db().from("posts").select("scheduled_at,created_at,status").eq("origin", "recap").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      statsStockage().catch(() => null),
    ]);
    if (p1.error) throw new Error(p1.error.message);
    const posts = [...((p1.data ?? []) as Ligne[]), ...((p2.data ?? []) as Ligne[])];
    const quand = (p: Ligne) => new Date(p.scheduled_at ?? p.created_at);

    // Courbe : publié par jour (passé) puis planifié (aujourd'hui restant + 2 jours)
    const jours = Array.from({ length: 9 }, (_, i) => {
      const d = new Date(debut.getTime() + i * JOUR);
      return { date: cle(d), publie: 0, citations: 0, prevu: 0, prevuCitations: 0 };
    });
    const idx = new Map(jours.map((j, i) => [j.date, i]));
    for (const p of posts) {
      const i = idx.get(cle(quand(p)));
      if (i === undefined) continue;
      if (p.status === "publie") { jours[i].publie++; if (p.rubrique === "citation") jours[i].citations++; }
      if (p.status === "planifie" || p.status === "a_valider") { jours[i].prevu++; if (p.rubrique === "citation") jours[i].prevuCitations++; }
    }

    // Rubriques : 7 derniers jours (et à venir pour les planifiés)
    const rub: Record<string, Record<string, number>> = {};
    let sansPhoto = 0;
    const erreurs: { id: string; titre: string; rubrique: string; detail: string }[] = [];
    for (const p of posts) {
      const r = (rub[p.rubrique] ??= {});
      r[p.status] = (r[p.status] ?? 0) + 1;
      if (p.origin === "recap" && p.status === "publie") r.recap = (r.recap ?? 0) + 1;
      if (p.rubrique === "citation" && (p.status === "erreur" || p.status === "planifie") && !p.photo) sansPhoto++;
      if (p.status === "erreur") {
        const det = Object.values(p.results ?? {}).find((x) => x && !x.ok)?.detail ?? "";
        erreurs.push({ id: p.id, titre: p.title ?? "", rubrique: p.rubrique, detail: det });
      }
    }
    const rubOf = (id: string) => rub[id] ?? {};
    const futurs = posts.filter((p) => p.status === "planifie" && quand(p) > now);

    // Sources les plus reprises
    const src = new Map<string, number>();
    for (const p of posts) if (p.status === "publie" && p.source_name) src.set(p.source_name, (src.get(p.source_name) ?? 0) + 1);
    const sources = [...src.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([nom, n]) => ({ nom, n }));

    const eps = ((minute.data?.data as { episodes?: { statut: string; numero?: number }[] } | null)?.episodes ?? []);
    return NextResponse.json({
      maintenant: now.toISOString(),
      autopilot: reglages.autopilot,
      jours,
      rubriques: { actu: rubOf("actu"), citation: rubOf("citation"), cyberbase: rubOf("cyberbase"), portrait: rubOf("portrait") },
      planifiees: futurs.length,
      prochaine: (() => {
        const p = [...futurs].sort((a, b) => quand(a).getTime() - quand(b).getTime())[0];
        return p ? { at: quand(p).toISOString(), titre: p.title ?? "", rubrique: p.rubrique } : null;
      })(),
      citationsSansPhoto: sansPhoto,
      erreurs: erreurs.slice(0, 5),
      nbErreurs: erreurs.length,
      sources,
      minute: { total: eps.length, montes: eps.filter((e) => e.statut !== "brouillon").length, brouillons: eps.filter((e) => e.statut === "brouillon").length, dernier: Math.max(0, ...eps.map((e) => e.numero ?? 0)) },
      grin: { aTraiter: cm.count ?? 0 },
      recap: recap.data ? { date: (recap.data as { scheduled_at: string | null; created_at: string }).scheduled_at ?? (recap.data as { created_at: string }).created_at, statut: (recap.data as { status: string }).status } : null,
      media,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
