import { NextResponse } from "next/server";
import { db } from "@/lib/store";
import { changerMdpMembre, fermerSession, fermerSessions, hacher, lireAdmin, majAdmin, mdpValide, moi, sessionsDe, verifier } from "@/lib/equipe";
import { checkPassword } from "@/lib/session";
import { ROLE_NOM } from "@/lib/roles";

export const dynamic = "force-dynamic";

// GET : mon compte (profil, appareils, mes publications). Ouvert à toute l'équipe.
export async function GET() {
  try {
    const m = await moi();
    let profil: { nom: string; contact?: string; created_at?: string };
    if (m.uid === "admin") profil = { nom: (await lireAdmin()).nom || "" };
    else {
      const { data } = await db().from("membres").select("nom,contact,created_at").eq("id", m.uid).maybeSingle();
      profil = (data ?? { nom: "Membre" }) as typeof profil;
    }
    const depuis = new Date(Date.now() - 7 * 864e5).toISOString();
    const { data: ps } = await db().from("posts").select("id,title,idea,status,platforms,created_at,scheduled_at").eq("auteur_id", m.uid).order("created_at", { ascending: false }).limit(30);
    const posts = (ps ?? []) as { id: string; title: string; idea: string; status: string; platforms: string[]; created_at: string; scheduled_at: string | null }[];
    const sessions = (await sessionsDe(m.uid)).map((x) => ({ ...x, moi: x.id === m.sid }));
    if (m.sid) await db().from("sessions").update({ vu_at: new Date().toISOString() }).eq("id", m.sid);
    return NextResponse.json({
      uid: m.uid, role: m.role, roleNom: ROLE_NOM[m.role], ...profil, sessions,
      stats: { publies: posts.filter((p) => p.status === "publie" && p.created_at >= depuis).length, planifies: posts.filter((p) => p.status === "planifie").length, brouillons: posts.filter((p) => p.status === "brouillon").length },
      posts: posts.slice(0, 8),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST { action: "nom" | "mdp" | "deconnecter" | "deconnecter-tout", … }
export async function POST(req: Request) {
  try {
    const m = await moi();
    const b = (await req.json().catch(() => ({}))) as { action?: string; nom?: string; ancien?: string; nouveau?: string; id?: string };
    if (b.action === "nom") {
      const nom = (b.nom ?? "").trim().slice(0, 60);
      if (!nom) return NextResponse.json({ error: "Indiquez un nom." }, { status: 400 });
      if (m.uid === "admin") await majAdmin({ nom });
      else await db().from("membres").update({ nom }).eq("id", m.uid);
    } else if (b.action === "mdp") {
      if (m.uid === "admin") {
        const a = await lireAdmin();
        const ok = a.mdp_hash ? verifier(b.ancien ?? "", a.mdp_hash) : checkPassword(b.ancien ?? "");
        if (!ok) return NextResponse.json({ error: "Mot de passe actuel incorrect." }, { status: 400 });
        const err = mdpValide(b.nouveau ?? ""); if (err) return NextResponse.json({ error: err }, { status: 400 });
        await majAdmin({ mdp_hash: hacher(b.nouveau ?? "") });
      } else await changerMdpMembre(m.uid, b.ancien ?? "", b.nouveau ?? "");
      await fermerSessions(m.uid, m.sid); // les autres appareils devront se reconnecter
    } else if (b.action === "deconnecter" && b.id) await fermerSession(m.uid, b.id);
    else if (b.action === "deconnecter-tout") await fermerSessions(m.uid, m.sid);
    else return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
