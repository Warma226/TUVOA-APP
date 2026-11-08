import { NextResponse } from "next/server";
import { db } from "@/lib/store";
import { fermerSessions, inviter, listerMembres, majMembre, renouvelerInvitation, retirerMembre } from "@/lib/equipe";
import { ROLES_MEMBRES, type Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

// Réservé à l'administrateur principal (middleware). GET : équipe, publications par membre, journal.
export async function GET() {
  try {
    const membres = await listerMembres();
    const depuis = new Date(Date.now() - 7 * 864e5).toISOString();
    const { data } = await db().from("posts").select("id,title,idea,status,auteur_id,auteur_nom,platforms,created_at,scheduled_at").not("auteur_id", "is", null).gte("created_at", depuis).order("created_at", { ascending: false }).limit(200);
    const posts = (data ?? []) as { id: string; title: string; idea: string; status: string; auteur_id: string; auteur_nom: string; platforms: string[]; created_at: string; scheduled_at: string | null }[];
    const parMembre: Record<string, number> = {};
    for (const p of posts) if (p.status === "publie") parMembre[p.auteur_id] = (parMembre[p.auteur_id] ?? 0) + 1;
    const journal = posts.filter((p) => p.auteur_id !== "admin").slice(0, 12).map((p) => ({ id: p.id, auteur: p.auteur_nom, auteur_id: p.auteur_id, titre: p.title || p.idea, status: p.status, at: p.scheduled_at && p.status === "publie" ? p.scheduled_at : p.created_at }));
    return NextResponse.json({ membres, parMembre, journal });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST { action: "inviter" | "role" | "suspendre" | "reactiver" | "retirer" | "lien", … }
export async function POST(req: Request) {
  try {
    const b = (await req.json().catch(() => ({}))) as { action?: string; id?: string; nom?: string; contact?: string; role?: Role };
    if (b.action === "inviter") {
      const r = await inviter(b.nom ?? "", b.contact ?? "", (b.role ?? "redacteur") as Role);
      return NextResponse.json({ id: r.id, lien: `/invitation?t=${r.jeton}` });
    }
    if (!b.id) return NextResponse.json({ error: "Membre manquant." }, { status: 400 });
    if (b.action === "role") {
      if (!ROLES_MEMBRES.includes(b.role as Role)) return NextResponse.json({ error: "Rôle inconnu." }, { status: 400 });
      await majMembre(b.id, { role: b.role });
    } else if (b.action === "suspendre") await majMembre(b.id, { statut: "suspendu" });
    else if (b.action === "reactiver") {
      const { data } = await db().from("membres").select("mdp_hash").eq("id", b.id).maybeSingle();
      await majMembre(b.id, { statut: data?.mdp_hash ? "actif" : "invite" });
    } else if (b.action === "retirer") await retirerMembre(b.id);
    else if (b.action === "lien") {
      // Nouveau lien : sert aussi au mot de passe oublié (l'ancien mot de passe ne marche plus après usage).
      const jeton = await renouvelerInvitation(b.id);
      return NextResponse.json({ lien: `/invitation?t=${jeton}` });
    } else if (b.action === "deconnecter") await fermerSessions(b.id);
    else return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
