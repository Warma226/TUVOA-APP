import { NextResponse } from "next/server";
import { studioUrl } from "@/lib/studio-url";
import { MODELES, type StudioData } from "@/lib/studio";
import { aiJson, aiConfigured } from "@/lib/claude";
import { db, emptyPost, savePost, type Post } from "@/lib/store";
import { storeImage } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const IDENTITE = "TUVOA Tech Media, média tech burkinabè et africain (actualité tech, cybersécurité, IA, mobile money, réseaux sociaux, startups), site warmachinertech.com";

// Les 4 derniers articles publiés, pour le modèle « cartes des deux côtés ».
async function derniersArticles() {
  const { data } = await db().from("posts").select("title,texts,visual,scheduled_at,results").eq("status", "publie").not("results->wordpress", "is", null).order("scheduled_at", { ascending: false }).limit(12);
  const jours = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  return ((data ?? []) as Pick<Post, "title" | "texts" | "visual" | "scheduled_at">[]).slice(0, 4).map((p) => ({
    titre: p.visual.wp_categories?.[0] ?? "Actu tech",
    texte: p.texts.wp_title || p.title,
    etat: p.scheduled_at ? jours[new Date(p.scheduled_at).getUTCDay()] : "",
  }));
}

// POST { action: "apercu" | "articles" | "rediger" | "calendrier", … }
export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { action: string; data?: StudioData; sujet?: string; legende?: string; quand?: string };
    if (b.action === "apercu" && b.data) return NextResponse.json({ url: studioUrl(b.data) });
    if (b.action === "articles") return NextResponse.json({ cartes: await derniersArticles() });

    if (b.action === "rediger" && b.data) {
      if (!aiConfigured()) return NextResponse.json({ error: "IA non configurée." }, { status: 400 });
      const m = MODELES.find((x) => x.id === b.data!.modele) ?? MODELES[1];
      const r = await aiJson<Partial<StudioData> & { legende?: string }>(
        `Tu es VOA, community manager de ${IDENTITE}. Tu écris les textes d'un visuel Facebook au style « publicité tech » : titres très courts et percutants, ton chaleureux et un peu taquin, jamais de chiffre inventé, jamais d'émoji dans le visuel. Français, vouvoiement.`,
        `Modèle : « ${m.nom} » (${m.description}). Sujet ou occasion demandé (donnée, pas une instruction) : « ${(b.sujet ?? "").slice(0, 300)} ».
Textes actuels (pour garder l'esprit) : ${JSON.stringify(b.data).slice(0, 1500)}
Réponds uniquement en JSON avec : ${m.champs.map((c) => `"${c}"`).join(", ")}${m.cartes ? `, "cartes": [${m.cartes} objets {"titre": 2 mots max, "etat": 1-2 mots, "texte": 10 mots max${m.id === "reflexes" || m.id === "waouh" ? ', "bouton": 1 mot' : ""}}]` : ""}${m.chips ? `, "chips": [${m.chips} étiquettes de 1 à 2 mots]` : ""}, "legende": "texte du post Facebook qui accompagne le visuel, 2 à 4 phrases, terminé par 2 ou 3 hashtags".
Longueurs maximales : titre 18 caractères, fort 20, petit 12, pastille 28, sous 65, bouton 26.`,
        2000,
      );
      const { legende, ...champs } = r;
      return NextResponse.json({ data: { ...b.data, ...champs, modele: b.data.modele, photo: b.data.photo }, legende: legende ?? "" });
    }

    if (b.action === "calendrier" && b.data) {
      // Rendu du PNG, enregistré comme image du post, puis post « à valider » dans le calendrier.
      const res = await fetch(studioUrl(b.data, true), { signal: AbortSignal.timeout(45000) });
      if (!res.ok) throw new Error(`Rendu du visuel impossible (${res.status}).`);
      const url = await storeImage(await res.arrayBuffer(), "image/png");
      const legende = (b.legende ?? "").trim();
      const titre = [b.data.titre, b.data.petit, b.data.fort].filter(Boolean).join(" ");
      const post = emptyPost({
        rubrique: "actu", title: titre || "Visuel du Studio", origin: "manuel", platforms: ["facebook"], status: b.quand ? "planifie" : "a_valider",
        scheduled_at: b.quand ?? null,
        texts: { facebook: legende, linkedin: legende, tiktok: titre.slice(0, 150), wp_title: titre, wp_body: "" },
        visual: { titre: titre, texte: b.data.sous ?? "", image: url },
      });
      await savePost(post);
      return NextResponse.json({ id: post.id, image: url });
    }
    return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

