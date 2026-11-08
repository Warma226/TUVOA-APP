// Vidéos YouTube réutilisables (licence Creative Commons CC BY uniquement) et repérage des extraits par Gemini.
import { db } from "./store";

export type VideoYT = { id: string; titre: string; chaine: string; chaineId: string; publie: string; duree: number; langue: string; vues: number; miniature: string; description: string; theme: string };
export type Extrait = { debut: number; fin: number; titre: string; pourquoi: string; soustitres: string; format: "reel" | "carrousel" };
export type LigneVideo = { id: string; info: VideoYT; extraits: Extrait[] | null; statut: string; pertinence: number; publie_at: string | null };

// Recherches thématiques : seules les vidéos sous licence Creative Commons ressortent (videoLicense=creativeCommon).
export const THEMES: { id: string; nom: string; requetes: [string, string][] }[] = [
  { id: "cyber", nom: "Cybersécurité", requetes: [["cybersécurité arnaque", "fr"], ["cybersecurity explained", "en"], ["phishing scam explained", "en"]] },
  { id: "ia", nom: "IA", requetes: [["intelligence artificielle expliquée", "fr"], ["artificial intelligence explained", "en"]] },
  { id: "afrique", nom: "Afrique & télécoms", requetes: [["tech Afrique numérique", "fr"], ["African tech startups", "en"], ["mobile money", "en"]] },
  { id: "tech", nom: "Actu tech", requetes: [["actualité tech", "fr"], ["technology news explained", "en"]] },
];

const iso = (s: string) => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(s) ?? []; return (+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + (+(m[3] ?? 0)); };

export function cleYoutube(): string {
  const k = process.env.YOUTUBE_API_KEY;
  if (!k) throw new Error("Ajoutez YOUTUBE_API_KEY dans Vercel pour activer les vidéos à reprendre.");
  return k;
}

async function yt(chemin: string, params: Record<string, string>) {
  const u = new URL(`https://www.googleapis.com/youtube/v3/${chemin}`);
  for (const [k, v] of Object.entries({ ...params, key: cleYoutube() })) u.searchParams.set(k, v);
  const r = await fetch(u, { cache: "no-store", signal: AbortSignal.timeout(20000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`YouTube : ${(d as { error?: { message?: string } }).error?.message ?? r.status}`);
  return d as { items?: Record<string, unknown>[] };
}

// Cherche les vidéos CC BY des 7 derniers jours, vérifie la licence une par une, enregistre les nouvelles.
export async function rafraichir(): Promise<number> {
  const depuis = new Date(Date.now() - 7 * 864e5).toISOString();
  const trouves = new Map<string, string>();
  for (const t of THEMES) for (const [q, lang] of t.requetes) {
    const r = await yt("search", { part: "id", q, type: "video", videoLicense: "creativeCommon", videoDuration: "medium", relevanceLanguage: lang, publishedAfter: depuis, maxResults: "10", order: "relevance", safeSearch: "strict" }).catch(() => ({ items: [] }));
    for (const it of r.items ?? []) { const id = (it.id as { videoId?: string })?.videoId; if (id && !trouves.has(id)) trouves.set(id, t.id); }
  }
  if (!trouves.size) return 0;
  const { data: deja } = await db().from("videos_yt").select("id").in("id", [...trouves.keys()]);
  const nouveaux = [...trouves.keys()].filter((id) => !(deja ?? []).some((d) => d.id === id));
  let n = 0;
  for (let i = 0; i < nouveaux.length; i += 50) {
    const r = await yt("videos", { part: "snippet,contentDetails,status,statistics", id: nouveaux.slice(i, i + 50).join(",") });
    const lignes = (r.items ?? []).flatMap((v) => {
      const s = v.snippet as { title: string; channelTitle: string; channelId: string; publishedAt: string; defaultAudioLanguage?: string; defaultLanguage?: string; description: string; thumbnails?: Record<string, { url: string }> };
      const st = v.status as { license?: string; embeddable?: boolean };
      if (st?.license !== "creativeCommon" || st.embeddable === false) return []; // double vérification de la licence
      const duree = iso((v.contentDetails as { duration: string }).duration);
      const vues = Number((v.statistics as { viewCount?: string })?.viewCount ?? 0);
      const info: VideoYT = {
        id: v.id as string, titre: s.title, chaine: s.channelTitle, chaineId: s.channelId, publie: s.publishedAt, duree,
        langue: (s.defaultAudioLanguage || s.defaultLanguage || "").slice(0, 2), vues,
        miniature: s.thumbnails?.medium?.url ?? s.thumbnails?.default?.url ?? "", description: (s.description ?? "").slice(0, 600), theme: trouves.get(v.id as string) ?? "tech",
      };
      const pertinence = Math.min(99, Math.round(40 + Math.log10(vues + 10) * 9 + (info.langue === "fr" ? 12 : 0) + (duree < 1200 ? 6 : 0)));
      return [{ id: info.id, info, pertinence, publie_at: s.publishedAt }];
    });
    if (lignes.length) { const { error } = await db().from("videos_yt").upsert(lignes); if (error) throw new Error(error.message); n += lignes.length; }
  }
  return n;
}

export async function lister(): Promise<LigneVideo[]> {
  const { data, error } = await db().from("videos_yt").select("id,info,extraits,statut,pertinence,publie_at").neq("statut", "ecarte").gte("publie_at", new Date(Date.now() - 10 * 864e5).toISOString()).order("pertinence", { ascending: false }).limit(60);
  if (error) throw new Error(error.message);
  return (data ?? []) as LigneVideo[];
}

// Gemini regarde la vidéo publique (lien YouTube) et propose 3 à 4 extraits de 20 à 45 s, avec sous-titres en français.
export async function reperer(id: string): Promise<Extrait[]> {
  const cle = process.env.GEMINI_API_KEY;
  if (!cle) throw new Error("Le repérage des extraits demande GEMINI_API_KEY dans Vercel.");
  const { data } = await db().from("videos_yt").select("info").eq("id", id).maybeSingle();
  const info = data?.info as VideoYT | undefined;
  if (!info) throw new Error("Vidéo inconnue.");
  const consigne = `Tu es éditeur vidéo pour TUVOA Tech Media, un média tech francophone (Afrique de l'Ouest), qui publie des Reels, TikTok et carrousels.
Regarde cette vidéo (« ${info.titre} », chaîne ${info.chaine}) et choisis 3 ou 4 extraits à couper, de 20 à 45 secondes chacun, qui tiennent seuls : une accroche forte, une explication claire, un conseil pratique ou une phrase choc. Évite les intros, les sponsors et les appels à s'abonner.
Réponds uniquement en JSON : [{"debut": secondes, "fin": secondes, "titre": "titre court en français", "pourquoi": "une phrase en français", "soustitres": "transcription traduite en français de l'extrait, 400 caractères max", "format": "reel" ou "carrousel"}]`;
  const modeles = ["gemini-2.5-flash", "gemini-2.0-flash"];
  let derniere = "";
  for (const m of modeles) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": cle },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ fileData: { fileUri: `https://www.youtube.com/watch?v=${id}` } }, { text: consigne }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.4 } }),
      signal: AbortSignal.timeout(240000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { derniere = (d as { error?: { message?: string } }).error?.message ?? `Erreur ${r.status}`; continue; }
    const txt = ((d as { candidates?: { content?: { parts?: { text?: string }[] } }[] }).candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    let liste: Extrait[] = [];
    try { liste = JSON.parse(txt.replace(/^```json\s*|```$/g, "")); } catch { derniere = "Réponse illisible."; continue; }
    liste = liste.filter((e) => Number.isFinite(e.debut) && Number.isFinite(e.fin) && e.fin > e.debut && e.debut >= 0 && e.fin <= info.duree + 1)
      .map((e) => ({ ...e, debut: Math.round(e.debut), fin: Math.round(Math.min(e.fin, e.debut + 60)), format: (e.format === "carrousel" ? "carrousel" : "reel") as Extrait["format"] })).slice(0, 4);
    if (!liste.length) { derniere = "Aucun extrait trouvé."; continue; }
    await db().from("videos_yt").update({ extraits: liste, statut: "analyse" }).eq("id", id);
    return liste;
  }
  throw new Error(`Repérage impossible : ${derniere}`);
}

export async function ecarter(id: string) { await db().from("videos_yt").update({ statut: "ecarte" }).eq("id", id); }
