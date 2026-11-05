// TikTok (Content Posting API) : connexion OAuth du compte TUVOA et publication de photos.
// Jetons enregistrés côté serveur (table settings, ligne 2), jamais exposés au navigateur.
import { db } from "./store";
import { appUrl, signParams } from "./sign";

type Tokens = { access_token: string; refresh_token: string; open_id: string; expires_at: number; refresh_expires_at: number; scope?: string };

export const TIKTOK_SCOPES = "user.info.basic,video.publish";
export const redirectUri = () => `${appUrl()}/api/tiktok/callback`;

export function tiktokConfigured(): boolean {
  return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
}

export function authorizeUrl(state: string): string {
  const p = new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_KEY ?? "", response_type: "code", scope: TIKTOK_SCOPES, redirect_uri: redirectUri(), state });
  return `https://www.tiktok.com/v2/auth/authorize/?${p.toString()}`;
}

async function loadTokens(): Promise<Tokens | null> {
  const { data } = await db().from("settings").select("data").eq("id", 2).maybeSingle();
  return (data?.data as Tokens | undefined) ?? null;
}
async function saveTokens(t: Tokens) {
  const { error } = await db().from("settings").upsert({ id: 2, data: t });
  if (error) throw new Error(error.message);
}

async function tokenRequest(body: Record<string, string>): Promise<Tokens> {
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_KEY ?? "", client_secret: process.env.TIKTOK_CLIENT_SECRET ?? "", ...body }),
  });
  const j = (await res.json()) as { access_token?: string; refresh_token?: string; open_id?: string; expires_in?: number; refresh_expires_in?: number; scope?: string; error?: string; error_description?: string };
  if (!res.ok || !j.access_token) throw new Error(`TikTok (jeton) : ${j.error_description || j.error || res.status}`);
  const now = Date.now();
  return {
    access_token: j.access_token,
    refresh_token: j.refresh_token ?? "",
    open_id: j.open_id ?? "",
    expires_at: now + (j.expires_in ?? 86400) * 1000,
    refresh_expires_at: now + (j.refresh_expires_in ?? 31536000) * 1000,
    scope: j.scope,
  };
}

export async function exchangeCode(code: string) {
  await saveTokens(await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() }));
}

// Jeton valide (renouvelé automatiquement une heure avant expiration).
export async function accessToken(): Promise<string> {
  const t = await loadTokens();
  if (!t) throw new Error("TikTok n'est pas encore relié : ouvre Connexions › TikTok › « Relier mon compte ».");
  if (t.expires_at - Date.now() > 3600_000) return t.access_token;
  if (t.refresh_expires_at < Date.now()) throw new Error("La connexion TikTok a expiré : relie à nouveau le compte dans Connexions.");
  const fresh = await tokenRequest({ grant_type: "refresh_token", refresh_token: t.refresh_token });
  await saveTokens(fresh);
  return fresh.access_token;
}

export async function tiktokUser(): Promise<{ name: string; privacy: string[] }> {
  const token = await accessToken();
  const res = await fetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
  });
  const j = (await res.json()) as { data?: { creator_nickname?: string; creator_username?: string; privacy_level_options?: string[] }; error?: { code?: string; message?: string } };
  if (!res.ok || (j.error?.code && j.error.code !== "ok")) throw new Error(`TikTok : ${j.error?.message || res.status}`);
  return { name: j.data?.creator_nickname || j.data?.creator_username || "compte TikTok", privacy: j.data?.privacy_level_options ?? [] };
}

// Lien public (signé) qui sert l'image en JPEG 1080 px : TikTok n'accepte que JPEG/WebP depuis un domaine vérifié.
export function tiktokImageUrl(src: string): string {
  const p = new URLSearchParams({ u: src });
  p.set("sig", signParams(p));
  return `${appUrl()}/api/media?${p.toString()}`;
}

// Publication d'une photo (ou d'un carrousel) avec sa légende.
export async function publishPhotos(images: string[], title: string, description: string): Promise<{ publish_id: string; privacy: string }> {
  const token = await accessToken();
  const { privacy } = await tiktokUser();
  // Tant que l'application n'est pas validée par TikTok, seule la visibilité « moi uniquement » est proposée.
  const level = privacy.includes("PUBLIC_TO_EVERYONE") ? "PUBLIC_TO_EVERYONE" : privacy[0] ?? "SELF_ONLY";
  const res = await fetch("https://open.tiktokapis.com/v2/post/publish/content/init/", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({
      post_info: { title: title.slice(0, 90), description: description.slice(0, 4000), disable_comment: false, privacy_level: level, auto_add_music: true },
      source_info: { source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: images.slice(0, 35).map(tiktokImageUrl) },
      post_mode: "DIRECT_POST",
      media_type: "PHOTO",
    }),
  });
  const j = (await res.json()) as { data?: { publish_id?: string }; error?: { code?: string; message?: string } };
  if (!res.ok || !j.data?.publish_id) throw new Error(`TikTok : ${j.error?.message || j.error?.code || res.status}`);
  return { publish_id: j.data.publish_id, privacy: level };
}
