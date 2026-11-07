// Accès aux données : Supabase si configuré, sinon mémoire (mode démo, réinitialisé au redémarrage).
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Platform, RubriqueId } from "./config";

export type PostStatus = "brouillon" | "a_valider" | "planifie" | "publie" | "erreur" | "annule";

export type PublishResult = { ok: boolean; detail: string; url?: string; at: string };

export type Post = {
  id: string;
  created_at: string;
  rubrique: RubriqueId;
  idea: string;
  title: string;
  source_name: string | null;
  source_url: string | null;
  origin: "manuel" | "veille" | "recap" | "test";
  trigger_id: string | null;
  texts: {
    facebook: string;
    linkedin: string;
    tiktok: string;
    wp_title: string;
    wp_body: string;
    wp_excerpt?: string; // extrait WordPress, repris comme méta-description
    commun?: string; // texte de base de l'éditeur (onglet « Commun »)
  };
  // image : visuel préparé par toi (lien), utilisé pour #CyberBase et #Portrait
  visual: {
    titre: string; texte: string; nom?: string; specialite?: string; photo?: string; image?: string; slides?: string[]; video?: string;
    // WordPress : légende et texte alternatif de l'image à la une, catégories, étiquettes, adresse, images supplémentaires
    legende?: string; alt?: string; image_secours?: string; wp_categories?: string[]; wp_tags?: string[]; wp_slug?: string; wp_maj?: "categories";
    wp_images?: { url: string; legende: string; alt?: string }[];
  };
  platforms: Platform[];
  status: PostStatus;
  scheduled_at: string | null;
  auto: boolean;
  results: Partial<Record<Platform, PublishResult>>;
};

export { DEFAULT_SETTINGS, mergeSettings, type Settings } from "./settings";
import { DEFAULT_SETTINGS, mergeSettings, type Settings } from "./settings";

let client: SupabaseClient | null = null;
export function isDemo() {
  return !(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
export function db(): SupabaseClient {
  if (!client) {
    client = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, {
      auth: { persistSession: false },
    });
  }
  return client;
}

type Mem = { posts: Post[]; settings: Settings; seen: Set<string> };
function mem(): Mem {
  const g = globalThis as unknown as { __tuvoa?: Mem };
  if (!g.__tuvoa) g.__tuvoa = { posts: [], settings: structuredClone(DEFAULT_SETTINGS), seen: new Set() };
  return g.__tuvoa;
}

export function newId() {
  return crypto.randomUUID();
}

export function emptyPost(partial: Partial<Post> = {}): Post {
  return {
    id: newId(),
    created_at: new Date().toISOString(),
    rubrique: "actu",
    idea: "",
    title: "",
    source_name: null,
    source_url: null,
    origin: "manuel",
    trigger_id: null,
    texts: { facebook: "", linkedin: "", tiktok: "", wp_title: "", wp_body: "" },
    visual: { titre: "", texte: "" },
    platforms: ["facebook", "linkedin", "wordpress"],
    status: "brouillon",
    scheduled_at: null,
    auto: false,
    results: {},
    ...partial,
  };
}

// ─── Posts ────────────────────────────────────────────────────────────
export async function listPosts(limit = 50): Promise<Post[]> {
  if (isDemo()) return [...mem().posts].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
  const { data, error } = await db().from("posts").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as Post[];
}

// Posts d'une période (calendrier) : prévus ou publiés entre deux dates, plus les brouillons créés pendant ce temps.
export async function listPostsEntre(de: string, a: string): Promise<Post[]> {
  if (isDemo()) return mem().posts.filter((p) => (p.scheduled_at ?? p.created_at) >= de && (p.scheduled_at ?? p.created_at) < a);
  const [r1, r2] = await Promise.all([
    db().from("posts").select("*").gte("scheduled_at", de).lt("scheduled_at", a).neq("status", "annule").limit(1500),
    db().from("posts").select("*").is("scheduled_at", null).gte("created_at", de).lt("created_at", a).neq("status", "annule").limit(300),
  ]);
  if (r1.error) throw new Error(r1.error.message);
  return [...((r1.data ?? []) as Post[]), ...((r2.data ?? []) as Post[])];
}

export async function getPost(id: string): Promise<Post | null> {
  if (isDemo()) return mem().posts.find((p) => p.id === id) ?? null;
  const { data, error } = await db().from("posts").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Post) ?? null;
}

export async function savePost(post: Post): Promise<Post> {
  if (isDemo()) {
    const m = mem();
    const i = m.posts.findIndex((p) => p.id === post.id);
    if (i >= 0) m.posts[i] = post;
    else m.posts.push(post);
    return post;
  }
  const { data, error } = await db().from("posts").upsert(post).select().single();
  if (error) throw new Error(error.message);
  return data as Post;
}

export async function deletePost(id: string): Promise<void> {
  if (isDemo()) {
    const m = mem();
    m.posts = m.posts.filter((p) => p.id !== id);
    return;
  }
  const { error } = await db().from("posts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function duePosts(): Promise<Post[]> {
  const now = new Date().toISOString();
  if (isDemo()) return mem().posts.filter((p) => p.status === "planifie" && p.scheduled_at && p.scheduled_at <= now);
  const { data, error } = await db().from("posts").select("*").eq("status", "planifie").lte("scheduled_at", now);
  if (error) throw new Error(error.message);
  return (data ?? []) as Post[];
}

// Posts automatiques récents (pour l'écart entre deux publications et éviter les doublons de sujet).
export async function recentAutoPosts(hours: number): Promise<Post[]> {
  const since = new Date(Date.now() - hours * 3.6e6).toISOString();
  if (isDemo()) return mem().posts.filter((p) => p.auto && p.created_at >= since);
  const { data, error } = await db().from("posts").select("*").eq("auto", true).gte("created_at", since).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Post[];
}

// Posts publiés depuis une date (pour le récap de la semaine).
export async function publishedSince(sinceIso: string): Promise<Post[]> {
  if (isDemo()) return mem().posts.filter((p) => p.status === "publie" && p.created_at >= sinceIso);
  const { data, error } = await db().from("posts").select("*").eq("status", "publie").gte("created_at", sinceIso).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Post[];
}

// Le récap de la semaine existe-t-il déjà ?
export async function recapExists(sinceIso: string): Promise<boolean> {
  if (isDemo()) return mem().posts.some((p) => p.origin === "recap" && p.created_at >= sinceIso);
  const { count, error } = await db().from("posts").select("id", { count: "exact", head: true }).eq("origin", "recap").gte("created_at", sinceIso);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

// Articles déjà utilisés pour un post (depuis toujours, manuels compris).
export async function postedUrls(urls: string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set();
  if (isDemo()) return new Set(mem().posts.map((p) => p.source_url ?? "").filter((u) => urls.includes(u)));
  const { data, error } = await db().from("posts").select("source_url").in("source_url", urls);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r: { source_url: string | null }) => r.source_url ?? ""));
}

// Publications TUVOA qui reprennent ces articles (adresse comparée sans paramètres ni « / » final).
export const urlNette = (u: string) => u.trim().replace(/[?#].*$/, "").replace(/\/+$/, "").replace(/^http:/, "https:").toLowerCase();
export async function postsParUrl(urls: string[]): Promise<Map<string, { id: string; status: string; at: string | null }>> {
  const out = new Map<string, { id: string; status: string; at: string | null }>();
  if (urls.length === 0) return out;
  type L = { id: string; status: string; scheduled_at: string | null; created_at: string; source_url: string | null; results: Post["results"] | null };
  let lignes: L[];
  if (isDemo()) lignes = mem().posts as L[];
  else {
    const variantes = [...new Set(urls.flatMap((u) => [u, u.replace(/[?#].*$/, ""), u.replace(/[?#].*$/, "").replace(/\/+$/, ""), `${u.replace(/[?#].*$/, "").replace(/\/+$/, "")}/`]))];
    const { data, error } = await db().from("posts").select("id,status,scheduled_at,created_at,source_url,results").in("source_url", variantes.slice(0, 600)).neq("status", "annule");
    if (error) throw new Error(error.message);
    lignes = (data ?? []) as L[];
  }
  const rang: Record<string, number> = { publie: 0, planifie: 1, a_valider: 2, erreur: 3, brouillon: 4 };
  for (const l of lignes) {
    if (!l.source_url || l.status === "annule") continue;
    const k = urlNette(l.source_url);
    const at = l.status === "publie" ? Object.values(l.results ?? {}).find((r) => r?.ok)?.at ?? l.scheduled_at : l.scheduled_at;
    const deja = out.get(k);
    if (!deja || (rang[l.status] ?? 9) < (rang[deja.status] ?? 9)) out.set(k, { id: l.id, status: l.status, at: at ?? l.created_at });
  }
  return out;
}

// Tous les posts récents (manuels compris), pour ne jamais republier un sujet déjà traité.
export async function recentPosts(hours: number): Promise<Post[]> {
  const since = new Date(Date.now() - hours * 3.6e6).toISOString();
  if (isDemo()) return mem().posts.filter((p) => p.created_at >= since);
  const { data, error } = await db().from("posts").select("id,title,source_url,created_at").gte("created_at", since);
  if (error) throw new Error(error.message);
  return (data ?? []) as Post[];
}

export async function countAutoToday(): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  if (isDemo()) return mem().posts.filter((p) => p.auto && p.created_at >= start.toISOString()).length;
  const { count, error } = await db()
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("auto", true)
    .gte("created_at", start.toISOString());
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// ─── Réglages ─────────────────────────────────────────────────────────
export async function getSettings(): Promise<Settings> {
  if (isDemo()) return mem().settings;
  const { data, error } = await db().from("settings").select("data").eq("id", 1).maybeSingle();
  if (error) throw new Error(error.message);
  return mergeSettings((data?.data ?? {}) as Partial<Settings>);
}

export async function saveSettings(s: Settings): Promise<Settings> {
  if (isDemo()) {
    mem().settings = s;
    return s;
  }
  const { error } = await db().from("settings").upsert({ id: 1, data: s });
  if (error) throw new Error(error.message);
  return s;
}

// ─── Articles déjà traités par la veille ─────────────────────────────
export async function filterUnseen(urls: string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set();
  if (isDemo()) return new Set(urls.filter((u) => !mem().seen.has(u)));
  const { data, error } = await db().from("seen_items").select("url").in("url", urls);
  if (error) throw new Error(error.message);
  const seen = new Set((data ?? []).map((r: { url: string }) => r.url));
  return new Set(urls.filter((u) => !seen.has(u)));
}

export async function markSeen(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  if (isDemo()) {
    urls.forEach((u) => mem().seen.add(u));
    return;
  }
  const { error } = await db().from("seen_items").upsert(urls.map((url) => ({ url })));
  if (error) throw new Error(error.message);
}
