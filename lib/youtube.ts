// Vidéos YouTube des chaînes suivies (Micode, France 24…), filtrées sur l'actu tech, et repérage des moments forts par Gemini.
// Droits : une vidéo ne peut être coupée et republiée que si elle est sous licence CC BY ou si la chaîne a donné son
// autorisation (case « Autorisation obtenue »). Sinon, on la commente, on cite une phrase courte et on renvoie vers l'original.
import { aiJson } from "./claude";
import { db } from "./store";

export type Genre = "actu" | "interview" | "docu";
export type Licence = "cc" | "autorisee" | "reservee";
export type VideoYT = { id: string; titre: string; chaine: string; chaineId: string; publie: string; duree: number; langue: string; vues: number; miniature: string; description: string; genre: Genre; cc: boolean; tri?: number; theme?: string };
export type Extrait = { debut: number; fin: number; titre: string; pourquoi: string; soustitres: string; citation?: string; format: "reel" | "carrousel" };
export type LigneVideo = { id: string; info: VideoYT; extraits: Extrait[] | null; statut: string; pertinence: number; publie_at: string | null; licence: Licence };
export type Chaine = { handle: string; nom: string; type: "tech" | "info"; id?: string; uploads?: string; autorisee?: boolean; introuvable?: boolean };

// « tech » : toute la chaîne parle de tech. « info » : chaîne d'actualité générale, on ne garde que les sujets tech.
export const CHAINES_DEFAUT: Chaine[] = [
  { handle: "@Micode", nom: "Micode", type: "tech" },
  { handle: "@Underscore_", nom: "Underscore_", type: "tech" },
  { handle: "@FRANCE24", nom: "FRANCE 24", type: "info" },
  { handle: "@franceinfo", nom: "franceinfo", type: "info" },
  { handle: "@BBCAfrique", nom: "BBC News Afrique", type: "info" },
  { handle: "@TV5MONDEInfo", nom: "TV5MONDE Info", type: "info" },
  { handle: "@HugoDecrypte", nom: "HugoDécrypte", type: "info" },
  { handle: "@lemondefr", nom: "Le Monde", type: "info" },
  { handle: "@artefr", nom: "ARTE", type: "info" },
  { handle: "@lesnumeriques", nom: "Les Numériques", type: "tech" },
  { handle: "@frandroid", nom: "Frandroid", type: "tech" },
  { handle: "@MonsieurBidouille", nom: "Monsieur Bidouille", type: "tech" },
];

// Mots qui signalent un sujet tech dans une chaîne d'info générale.
const SIGLES = /\b(IA|5G|IoT|ChatGPT|OpenAI|Nvidia|TikTok|WhatsApp|Starlink|SpaceX|Tesla|Meta|Google|Apple|Microsoft|Amazon|Huawei|Samsung|Xiaomi|Pegasus)\b/; // sensibles à la casse (« IA », pas « ia »)
const TECH = /\b(intelligence artificielle|cyber\w*|hack\w*|pirat\w*|ran[çc]ongiciels?|phishing|hameçonnage|données personnelles|fuites? de données|espionn\w*|technolog\w*|numérique|internet|réseaux sociaux|Facebook|Instagram|Telegram|YouTube|iPhone|Musk|Zuckerberg|Altman|satellites?|robots?|robotique|drones?|algorithmes?|deepfakes?|bitcoin|cryptomonnaies?|blockchain|mobile money|start-?ups?|smartphones?|data ?centers?|centres? de données|semi-?conducteurs?|puces électroniques|quantique|logiciels?|applis?|applications?|Silicon Valley|géants de la tech|big tech)\b/i;
// Formations, tutos, guides d'achat et contenus hors actualité : écartés d'office.
const HORS = /#shorts|\btuto\w*|formation|\bcours\b|leçon|débutants?|apprendre|comment (faire|installer|configurer|utiliser)|guide d'achat|top \d+|bons? plans?|promo\b|meilleurs? .* à moins de|#soins|unboxing|masterclass|webinaire/i;
const DOCU = /documentaire|docu\b|enquête|reportage|investigation|grand format|immersion|documentary|investigat/i;
const INTERVIEW = /interview|entretien|invitée?|face à|podcast|débat|répond|confessions?|témoign|conversation|talk|«|"/i;

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

// Chaînes anglophones retirées de la liste par défaut (français uniquement).
const RETIREES = ["@TheVerge", "@WIRED", "@BloombergTechnology"];
const TRI = 2; // version du tri : les vidéos triées avec une version plus ancienne sont retriées

// Liste des chaînes suivies (settings, ligne 7).
export async function lireChaines(): Promise<Chaine[]> {
  const { data } = await db().from("settings").select("data").eq("id", 7).maybeSingle();
  const l = (data?.data as { chaines?: Chaine[] } | null)?.chaines;
  return Array.isArray(l) && l.length ? l.filter((c) => !RETIREES.includes(c.handle)) : CHAINES_DEFAUT;
}
async function ecrireChaines(chaines: Chaine[]) { await db().from("settings").upsert({ id: 7, data: { chaines } }); }

export async function ajouterChaine(saisie: string, type: Chaine["type"]) {
  let h = saisie.trim().replace(/^https?:\/\/(www\.)?youtube\.com\//i, "").replace(/\/.*$/, "");
  if (!h) throw new Error("Indiquez le @nom de la chaîne.");
  if (!h.startsWith("@") && !h.startsWith("UC")) h = `@${h}`;
  const l = await lireChaines();
  if (l.some((c) => c.handle.toLowerCase() === h.toLowerCase())) throw new Error("Cette chaîne est déjà suivie.");
  const c: Chaine = { handle: h, nom: h.replace(/^@/, ""), type };
  await resoudre(c);
  if (c.introuvable) throw new Error(`Chaîne introuvable sur YouTube : ${h}`);
  await ecrireChaines([...l, c]);
  return c;
}
export async function majChaine(handle: string, champs: Partial<Pick<Chaine, "autorisee" | "type">>, retirer = false) {
  const l = await lireChaines();
  await ecrireChaines(retirer ? l.filter((c) => c.handle !== handle) : l.map((c) => (c.handle === handle ? { ...c, ...champs } : c)));
}

async function resoudre(c: Chaine) {
  if (c.uploads || c.introuvable) return;
  const p: Record<string, string> = { part: "snippet,contentDetails" };
  if (c.handle.startsWith("UC")) p.id = c.handle; else p.forHandle = c.handle;
  const r = await yt("channels", p).catch(() => ({ items: [] }));
  const it = r.items?.[0];
  if (!it) { c.introuvable = true; return; }
  c.id = it.id as string;
  c.nom = (it.snippet as { title?: string })?.title || c.nom;
  c.uploads = (it.contentDetails as { relatedPlaylists?: { uploads?: string } })?.relatedPlaylists?.uploads;
  if (!c.uploads) c.introuvable = true;
}

// Dernières vidéos de chaque chaîne suivie (14 jours), sans les Shorts, filtrées tech pour les chaînes d'info.
export async function rafraichir(): Promise<number> {
  const chaines = await lireChaines();
  for (const c of chaines) await resoudre(c);
  await ecrireChaines(chaines);
  const depuis = Date.now() - 14 * 864e5;
  const ids: string[] = [];
  for (const c of chaines.filter((x) => x.uploads)) {
    const r = await yt("playlistItems", { part: "contentDetails", playlistId: c.uploads!, maxResults: c.type === "info" ? "50" : "20" }).catch(() => ({ items: [] }));
    for (const it of r.items ?? []) {
      const d = it.contentDetails as { videoId?: string; videoPublishedAt?: string };
      if (d?.videoId && (!d.videoPublishedAt || new Date(d.videoPublishedAt).getTime() > depuis)) ids.push(d.videoId);
    }
  }
  if (!ids.length) return 0;
  const { data: deja } = await db().from("videos_yt").select("id").in("id", ids).eq("info->>tri", String(TRI));
  const nouveaux = ids.filter((id) => !(deja ?? []).some((d) => d.id === id));
  const parId = new Map(chaines.map((c) => [c.id, c]));
  let n = 0;
  for (let i = 0; i < nouveaux.length; i += 50) {
    const r = await yt("videos", { part: "snippet,contentDetails,status,statistics", id: nouveaux.slice(i, i + 50).join(",") });
    const lignes = (r.items ?? []).flatMap((v) => {
      const s = v.snippet as { title: string; channelTitle: string; channelId: string; publishedAt: string; defaultAudioLanguage?: string; defaultLanguage?: string; description: string; liveBroadcastContent?: string; thumbnails?: Record<string, { url: string }> };
      const st = v.status as { license?: string; embeddable?: boolean; privacyStatus?: string };
      const c = parId.get(s.channelId);
      if (!c || st?.privacyStatus !== "public" || s.liveBroadcastContent !== "none") return [];
      const duree = iso((v.contentDetails as { duration: string }).duration);
      if (duree < 90) return []; // Shorts et bandes-annonces
      const langue = (s.defaultAudioLanguage || s.defaultLanguage || "").slice(0, 2);
      if (langue && langue !== "fr") return []; // français uniquement
      if (HORS.test(s.title)) return [];
      const texte = `${s.title} ${(s.description ?? "").slice(0, 250)}`;
      if (c.type === "info" && !TECH.test(texte) && !SIGLES.test(texte)) return []; // chaîne d'info : sujets tech seulement
      const genre: Genre = duree >= 1200 || DOCU.test(s.title) ? "docu" : INTERVIEW.test(s.title) ? "interview" : "actu";
      const vues = Number((v.statistics as { viewCount?: string })?.viewCount ?? 0);
      const info: VideoYT = {
        id: v.id as string, titre: s.title, chaine: s.channelTitle, chaineId: s.channelId, publie: s.publishedAt, duree, langue, vues,
        miniature: s.thumbnails?.high?.url ?? s.thumbnails?.medium?.url ?? "", description: (s.description ?? "").slice(0, 600), genre, cc: st?.license === "creativeCommon", tri: TRI,
      };
      const jours = (Date.now() - new Date(s.publishedAt).getTime()) / 864e5;
      const pertinence = Math.max(1, Math.min(99, Math.round(30 + Math.log10(vues + 10) * 8 + (langue === "fr" ? 10 : 0) + (genre !== "actu" ? 8 : 0) + (c.type === "info" ? 6 : 0) - jours * 2.5)));
      return [{ id: info.id, info, pertinence, publie_at: s.publishedAt }];
    });
    if (!lignes.length) continue;
    const garder = await trier(lignes.map((l) => l.info));
    const tri = lignes.map((l) => ({ ...l, statut: garder.has(l.id) ? "nouveau" : "hors_sujet" }));
    // une vidéo déjà analysée ou écartée garde ses extraits et son statut
    const { data: anciens } = await db().from("videos_yt").select("id,statut,extraits").in("id", tri.map((l) => l.id));
    for (const l of tri) { const a = (anciens ?? []).find((x) => x.id === l.id); if (a && l.statut === "nouveau" && a.statut !== "hors_sujet") Object.assign(l, { statut: a.statut, extraits: a.extraits }); }
    const { error } = await db().from("videos_yt").upsert(tri);
    if (error) throw new Error(error.message);
    n += tri.filter((l) => l.statut === "nouveau").length;
  }
  return n;
}

// Tri final par l'IA, strict : actualité tech en français uniquement. Sans IA disponible, seuls les filtres ci-dessus s'appliquent.
async function trier(videos: VideoYT[]): Promise<Set<string>> {
  const garder = new Set<string>();
  for (let i = 0; i < videos.length; i += 40) {
    const lot = videos.slice(i, i + 40);
    try {
      const r = await aiJson<{ garder?: string[] }>(
        `Tu es rédacteur en chef de TUVOA Tech Media, un média d'actualité tech francophone. Tu tries des vidéos YouTube avec rigueur : dans le doute, tu écartes.
GARDER seulement si les deux conditions sont vraies :
1. La vidéo est en français.
2. Son sujet principal est l'actualité de la tech et du numérique : IA, cybersécurité et arnaques en ligne, réseaux sociaux et plateformes, géants de la tech et leurs dirigeants, télécoms et mobile money, startups, spatial, data centers, crypto (sous l'angle technologique), lois et politique du numérique, sorties et annonces de produits tech, enquêtes, documentaires et interviews sur la tech.
ÉCARTER : tutoriels, formations, cours, conseils pour débutants, guides d'achat, « top » et comparatifs d'achat, bons plans, beauté et électroménager, finance et bourse pure, politique, sport, climat, culture ou société sans angle tech central, journaux d'information multi-sujets, Shorts.
Réponds uniquement en JSON : {"garder": ["id", ...]}`,
        lot.map((v) => `${v.id} | ${v.chaine} | ${v.titre} | ${v.description.replace(/\s+/g, " ").slice(0, 200)}`).join("\n"),
        1500,
      );
      for (const id of r.garder ?? []) if (lot.some((v) => v.id === id)) garder.add(id);
    } catch (e) {
      console.error("[videos] tri IA impossible", (e as Error).message);
      for (const v of lot) if (TECH.test(v.titre) || SIGLES.test(v.titre)) garder.add(v.id);
    }
  }
  return garder;
}

export async function lister(): Promise<{ videos: LigneVideo[]; chaines: Chaine[] }> {
  const chaines = await lireChaines();
  const suivies = chaines.filter((c) => c.id).map((c) => c.id!);
  if (!suivies.length) return { videos: [], chaines };
  const { data, error } = await db().from("videos_yt").select("id,info,extraits,statut,pertinence,publie_at").not("statut", "in", "(ecarte,hors_sujet)").eq("info->>tri", String(TRI)).in("info->>chaineId", suivies).gte("publie_at", new Date(Date.now() - 14 * 864e5).toISOString()).order("publie_at", { ascending: false }).limit(150);
  if (error) throw new Error(error.message);
  const auto = new Set(chaines.filter((c) => c.autorisee).map((c) => c.id));
  const videos = ((data ?? []) as Omit<LigneVideo, "licence">[])
    .filter((v) => v.info.genre) // anciennes lignes (recherche CC BY) ignorées
    .map((v) => ({ ...v, licence: (v.info.cc ? "cc" : auto.has(v.info.chaineId) ? "autorisee" : "reservee") as Licence }))
    .sort((a, b) => b.pertinence - a.pertinence);
  return { videos, chaines };
}

// Gemini regarde la vidéo (lien YouTube public) : moments chocs pour une interview ou un documentaire, extraits forts pour une actu.
export async function reperer(id: string): Promise<Extrait[]> {
  const cle = process.env.GEMINI_API_KEY;
  if (!cle) throw new Error("Le repérage des extraits demande GEMINI_API_KEY dans Vercel.");
  const { data } = await db().from("videos_yt").select("info").eq("id", id).maybeSingle();
  const info = data?.info as VideoYT | undefined;
  if (!info) throw new Error("Vidéo inconnue.");
  const choc = info.genre !== "actu";
  const consigne = `Tu es éditeur vidéo pour TUVOA Tech Media, un média tech francophone (Afrique de l'Ouest) qui publie des Reels, TikTok et carrousels.
Vidéo : « ${info.titre} » (chaîne ${info.chaine}, ${info.genre === "docu" ? "documentaire" : info.genre === "interview" ? "interview" : "actualité"}).
${choc
  ? `Repère les 4 moments les plus CHOCS : une révélation, un aveu, un chiffre qui frappe, une prise de position tranchée, une phrase qu'on a envie de partager. Pour une interview, garde la parole de l'invité, pas les questions. Chaque moment fait 15 à 45 secondes et se comprend sans contexte.`
  : `Choisis 3 ou 4 extraits de 20 à 45 secondes qui tiennent seuls : l'info principale, une explication claire, un chiffre fort ou une phrase choc.`}
Évite les génériques, les sponsors et les appels à s'abonner. Les minutages doivent être exacts.
Réponds uniquement en JSON : [{"debut": secondes, "fin": secondes, "titre": "titre accrocheur en français, 70 caractères max", "pourquoi": "pourquoi ce moment marque, une phrase en français", "citation": "la phrase la plus forte, mot pour mot, traduite en français si besoin, 160 caractères max", "soustitres": "ce qui est dit dans l'extrait, en français, 400 caractères max", "format": "reel" ou "carrousel"}]`;
  // Alias « latest » : suit le modèle Flash courant de Google, sans changer le code à chaque nouvelle version.
  const modeles = ["gemini-flash-latest", "gemini-3.8-flash", "gemini-2.5-flash"];
  const erreurs: string[] = [];
  let derniere = "";
  for (const m of modeles) {
    const generationConfig: Record<string, unknown> = { responseMimeType: "application/json", temperature: 0.4 };
    if (info.duree > 1500) generationConfig.mediaResolution = "MEDIA_RESOLUTION_LOW"; // longs documentaires
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": cle },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ fileData: { fileUri: `https://www.youtube.com/watch?v=${id}` } }, { text: consigne }] }], generationConfig }),
      signal: AbortSignal.timeout(280000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { derniere = (d as { error?: { message?: string } }).error?.message ?? `Erreur ${r.status}`; erreurs.push(`${m} : ${derniere}`); continue; }
    const txt = ((d as { candidates?: { content?: { parts?: { text?: string }[] } }[] }).candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    let liste: Extrait[] = [];
    try { liste = JSON.parse(txt.replace(/^```json\s*|```$/g, "")); } catch { derniere = "Réponse illisible."; continue; }
    if (!Array.isArray(liste)) { derniere = "Réponse illisible."; continue; }
    liste = liste.filter((e) => Number.isFinite(e.debut) && Number.isFinite(e.fin) && e.fin > e.debut && e.debut >= 0 && e.fin <= info.duree + 1)
      .map((e) => ({ ...e, debut: Math.round(e.debut), fin: Math.round(Math.min(e.fin, e.debut + 60)), format: (e.format === "carrousel" ? "carrousel" : "reel") as Extrait["format"] }))
      .sort((a, b) => a.debut - b.debut).slice(0, 4);
    if (!liste.length) { derniere = "Aucun extrait trouvé."; continue; }
    await db().from("videos_yt").update({ extraits: liste, statut: "analyse" }).eq("id", id);
    return liste;
  }
  console.error("[videos] repérage", erreurs.join(" | "));
  throw new Error(`Repérage impossible : ${erreurs.length > 1 ? erreurs[0].replace(/^[^:]+ : /, "") : derniere}`);
}

export async function ecarter(id: string) { await db().from("videos_yt").update({ statut: "ecarte" }).eq("id", id); }
