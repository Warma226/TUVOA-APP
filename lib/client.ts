"use client";
// Accès aux données depuis le navigateur.
// Avec Supabase : tout passe par le serveur.
// Sans Supabase (mode démo) : les posts et réglages sont gardés dans ce navigateur (localStorage),
// car sur Vercel la mémoire du serveur n'est pas partagée entre les requêtes.
import type { Post } from "./store";
import { mergeSettings, type Settings } from "./settings";
import type { Platform } from "./config";

export type PostWithVisuals = Post & { visuals: Record<string, string> };
export type Info = {
  settings: Settings;
  demo: boolean;
  ai: boolean;
  aiProvider?: "claude" | "gemini" | null;
  connections: Record<Platform, { configured: boolean; detail: string }>;
};

const LS_POSTS = "tuvoa.posts.v1";
const LS_SETTINGS = "tuvoa.settings.v1";

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeLocal(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // stockage indisponible (navigation privée) : on continue sans mémoriser
  }
}

function stripVisuals(p: Post | PostWithVisuals): Post {
  const copy = { ...(p as PostWithVisuals) } as Partial<PostWithVisuals>;
  delete copy.visuals;
  return copy as Post;
}
function localPosts(): Post[] {
  return readLocal<Post[]>(LS_POSTS, []);
}
function storeLocal(p: Post | PostWithVisuals) {
  const clean = stripVisuals(p);
  const all = localPosts().filter((x) => x.id !== clean.id);
  all.push(clean);
  writeLocal(LS_POSTS, all);
}

async function json<T>(res: Response): Promise<T> {
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    throw new Error(res.status === 401 ? "Session expirée : recharge la page et reconnecte-toi." : `Erreur du serveur (${res.status}).`);
  }
  const d = data as { error?: string };
  if (!res.ok) throw new Error(d?.error || `Erreur du serveur (${res.status}).`);
  return data as T;
}

let demoFlag: boolean | null = null;

export async function getInfo(): Promise<Info> {
  const info = await json<Info>(await fetch("/api/settings", { cache: "no-store" }));
  demoFlag = info.demo;
  if (info.demo) {
    info.settings = mergeSettings(info.settings, readLocal<Partial<Settings>>(LS_SETTINGS, {}));
  }
  return info;
}

async function isDemo(): Promise<boolean> {
  if (demoFlag === null) await getInfo();
  return Boolean(demoFlag);
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  if (await isDemo()) {
    writeLocal(LS_SETTINGS, mergeSettings(readLocal<Partial<Settings>>(LS_SETTINGS, {}), patch));
    return;
  }
  await json(await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }));
}

async function postsApi(body: Record<string, unknown>): Promise<{ post?: PostWithVisuals; posts?: Post[] }> {
  return json(await fetch("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
}

export async function listPosts(): Promise<Post[]> {
  if (await isDemo()) return localPosts().sort((a, b) => b.created_at.localeCompare(a.created_at));
  const d = await json<{ posts: Post[] }>(await fetch("/api/posts", { cache: "no-store" }));
  return d.posts ?? [];
}

export async function loadPost(id: string): Promise<PostWithVisuals> {
  if (await isDemo()) {
    const p = localPosts().find((x) => x.id === id);
    if (!p) throw new Error("Post introuvable sur ce téléphone.");
    const d = await postsApi({ action: "visuals", post: p });
    return d.post as PostWithVisuals;
  }
  const d = await json<{ post: PostWithVisuals }>(await fetch(`/api/posts?id=${encodeURIComponent(id)}`, { cache: "no-store" }));
  return d.post;
}

export async function savePost(p: Partial<Post>): Promise<PostWithVisuals> {
  const d = await postsApi({ action: "save", post: p });
  const saved = d.post as PostWithVisuals;
  if (await isDemo()) storeLocal(saved);
  return saved;
}

export async function postAction(action: "schedule" | "publish" | "cancel", p: Post, at?: string): Promise<PostWithVisuals> {
  const demo = await isDemo();
  const d = await postsApi({ action, id: p.id, at, post: demo ? stripVisuals(p) : undefined });
  const next = d.post as PostWithVisuals;
  if (demo) storeLocal(next);
  return next;
}

export async function deletePost(id: string): Promise<void> {
  if (await isDemo()) {
    writeLocal(LS_POSTS, localPosts().filter((x) => x.id !== id));
    return;
  }
  await postsApi({ action: "delete", id });
}
