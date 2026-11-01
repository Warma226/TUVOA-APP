// Publication sur les canaux de TUVOA.
import type { Platform } from "./config";
import type { Post, PublishResult } from "./store";
import { imageFor } from "./visual-url";

type Publisher = (post: Post) => Promise<Omit<PublishResult, "at">>;

// LinkedIn date ses versions d'API (AAAAMM) et retire les plus anciennes au bout d'un an environ :
// on prend la version d'il y a deux mois, toujours disponible, sauf si LINKEDIN_VERSION est fixée.
function linkedinVersion(): string {
  if (process.env.LINKEDIN_VERSION) return process.env.LINKEDIN_VERSION;
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 2);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function connectionStatus(): Record<Platform, { configured: boolean; detail: string }> {
  return {
    wordpress: {
      configured: Boolean(process.env.WP_URL && process.env.WP_USER && process.env.WP_APP_PASSWORD),
      detail: process.env.WP_URL ? process.env.WP_URL.replace(/^https?:\/\//, "") : "WP_URL, WP_USER, WP_APP_PASSWORD",
    },
    facebook: {
      configured: Boolean(process.env.FB_PAGE_ID && process.env.FB_PAGE_TOKEN),
      detail: process.env.FB_PAGE_ID ? `Page ${process.env.FB_PAGE_ID}` : "FB_PAGE_ID, FB_PAGE_TOKEN",
    },
    linkedin: {
      configured: Boolean(process.env.LINKEDIN_TOKEN && process.env.LINKEDIN_AUTHOR),
      detail: process.env.LINKEDIN_AUTHOR ?? "LINKEDIN_TOKEN, LINKEDIN_AUTHOR",
    },
    tiktok: {
      configured: false,
      detail: "En attente de la validation de l'application par TikTok",
    },
  };
}

function imageUrl(post: Post, platform: Platform): string {
  const url = imageFor(post, platform, true);
  if (!url) throw new Error("Aucun visuel : ajoute le lien de ton visuel dans l'éditeur.");
  return url;
}

async function imageBytes(post: Post, platform: Platform): Promise<{ bytes: ArrayBuffer; type: string; ext: string }> {
  const res = await fetch(imageUrl(post, platform));
  if (!res.ok) throw new Error(`Visuel indisponible (${res.status})`);
  const type = (res.headers.get("content-type") ?? "image/png").split(";")[0];
  const ext = type.includes("jpeg") ? "jpg" : type.includes("webp") ? "webp" : "png";
  return { bytes: await res.arrayBuffer(), type, ext };
}

function escapeHtml(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const wordpress: Publisher = async (post) => {
  const base = (process.env.WP_URL ?? "").replace(/\/$/, "");
  const auth = "Basic " + Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString("base64");
  // 1. Image à la une
  const img = await imageBytes(post, "wordpress");
  const media = await fetch(`${base}/wp-json/wp/v2/media`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": img.type, "Content-Disposition": `attachment; filename="tuvoa-${post.id.slice(0, 8)}.${img.ext}"` },
    body: img.bytes,
  });
  if (!media.ok) throw new Error(`WordPress (image) ${media.status} : ${(await media.text()).slice(0, 200)}`);
  const mediaJson = (await media.json()) as { id: number };
  // 2. Article
  let content = post.texts.wp_body || `<p>${escapeHtml(post.texts.facebook)}</p>`;
  if (post.source_url && !content.includes(post.source_url)) {
    content += `<p>Source : <a href="${post.source_url}" rel="noopener">${escapeHtml(post.source_name ?? post.source_url)}</a></p>`;
  }
  const res = await fetch(`${base}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ title: post.texts.wp_title || post.title, content, status: "publish", featured_media: mediaJson.id }),
  });
  if (!res.ok) throw new Error(`WordPress ${res.status} : ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { link?: string };
  return { ok: true, detail: "Article publié", url: json.link };
};

const facebook: Publisher = async (post) => {
  const version = process.env.FB_GRAPH_VERSION || "v21.0";
  const body = new URLSearchParams({
    url: imageUrl(post, "facebook"),
    caption: post.texts.facebook,
    access_token: process.env.FB_PAGE_TOKEN ?? "",
  });
  const res = await fetch(`https://graph.facebook.com/${version}/${process.env.FB_PAGE_ID}/photos`, { method: "POST", body });
  const json = (await res.json()) as { id?: string; post_id?: string; error?: { message: string } };
  if (!res.ok || json.error) throw new Error(`Facebook : ${json.error?.message ?? res.status}`);
  return { ok: true, detail: "Photo publiée sur la Page", url: json.post_id ? `https://www.facebook.com/${json.post_id}` : undefined };
};

const linkedin: Publisher = async (post) => {
  const headers = {
    Authorization: `Bearer ${process.env.LINKEDIN_TOKEN}`,
    "LinkedIn-Version": linkedinVersion(),
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };
  const author = process.env.LINKEDIN_AUTHOR as string;
  // 1. Réserve l'emplacement de l'image
  const init = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
    method: "POST",
    headers,
    body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
  });
  if (!init.ok) throw new Error(`LinkedIn (image) ${init.status} : ${(await init.text()).slice(0, 200)}`);
  const { value } = (await init.json()) as { value: { uploadUrl: string; image: string } };
  // 2. Envoie l'image
  const up = await fetch(value.uploadUrl, { method: "PUT", headers: { Authorization: headers.Authorization }, body: (await imageBytes(post, "linkedin")).bytes });
  if (!up.ok) throw new Error(`LinkedIn (envoi image) ${up.status}`);
  // 3. Crée le post
  const res = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers,
    body: JSON.stringify({
      author,
      commentary: post.texts.linkedin,
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { media: { id: value.image, title: post.title || post.visual.titre } },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  if (!res.ok) throw new Error(`LinkedIn ${res.status} : ${(await res.text()).slice(0, 200)}`);
  return { ok: true, detail: "Post publié sur LinkedIn" };
};

const tiktok: Publisher = async () => {
  throw new Error("TikTok : publication disponible après la validation de l'application par TikTok.");
};

const PUBLISHERS: Record<Platform, Publisher> = { wordpress, facebook, linkedin, tiktok };

export async function publishPost(post: Post): Promise<Post> {
  const status = connectionStatus();
  const results = { ...post.results };
  for (const platform of post.platforms) {
    if (results[platform]?.ok) continue; // déjà publié
    const at = new Date().toISOString();
    if (!status[platform].configured) {
      results[platform] = { ok: false, detail: `${platform} n'est pas connecté`, at };
      continue;
    }
    try {
      results[platform] = { ...(await PUBLISHERS[platform](post)), at };
    } catch (e) {
      results[platform] = { ok: false, detail: (e as Error).message, at };
    }
  }
  const all = post.platforms.map((p) => results[p]);
  const allOk = all.every((r) => r?.ok);
  return { ...post, results, status: allOk ? "publie" : "erreur" };
}

// ─── Test des connexions (sans rien publier) ─────────────────────────
export type ConnectionTest = { ok: boolean; detail: string };

async function testWordpress(): Promise<ConnectionTest> {
  const base = (process.env.WP_URL ?? "").replace(/\/$/, "");
  const auth = "Basic " + Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString("base64");
  const res = await fetch(`${base}/wp-json/wp/v2/users/me?context=edit`, { headers: { Authorization: auth }, signal: AbortSignal.timeout(15000) });
  if (res.status === 401 || res.status === 403) return { ok: false, detail: "Identifiant ou mot de passe d'application refusé par WordPress." };
  if (res.status === 404) return { ok: false, detail: "API WordPress introuvable : vérifie WP_URL (adresse exacte du site)." };
  if (!res.ok) return { ok: false, detail: `WordPress a répondu ${res.status}.` };
  const me = (await res.json()) as { name?: string; capabilities?: Record<string, boolean> };
  if (me.capabilities && !me.capabilities.publish_posts) return { ok: false, detail: `Connecté en tant que ${me.name}, mais ce compte ne peut pas publier d'articles.` };
  return { ok: true, detail: `Connecté en tant que ${me.name ?? process.env.WP_USER}, peut publier.` };
}

async function testFacebook(): Promise<ConnectionTest> {
  const version = process.env.FB_GRAPH_VERSION || "v21.0";
  const url = `https://graph.facebook.com/${version}/${process.env.FB_PAGE_ID}?fields=name&access_token=${encodeURIComponent(process.env.FB_PAGE_TOKEN ?? "")}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const json = (await res.json().catch(() => ({}))) as { name?: string; error?: { message?: string } };
  if (!res.ok || json.error) return { ok: false, detail: `Facebook : ${json.error?.message ?? res.status}` };
  return { ok: true, detail: `Page « ${json.name} » accessible.` };
}

async function testLinkedin(): Promise<ConnectionTest> {
  const author = process.env.LINKEDIN_AUTHOR ?? "";
  const id = author.match(/^urn:li:organization:(\d+)$/)?.[1];
  if (!id) return { ok: false, detail: "LINKEDIN_AUTHOR doit avoir la forme urn:li:organization:123456." };
  const res = await fetch(`https://api.linkedin.com/rest/organizations/${id}`, {
    headers: { Authorization: `Bearer ${process.env.LINKEDIN_TOKEN}`, "LinkedIn-Version": linkedinVersion(), "X-Restli-Protocol-Version": "2.0.0" },
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 401) return { ok: false, detail: "Jeton LinkedIn refusé ou expiré : génère-en un nouveau." };
  if (res.status === 403) return { ok: false, detail: "Jeton valide, mais sans droit sur cette Page (il faut être administrateur et avoir l'accès Community Management)." };
  if (!res.ok) return { ok: false, detail: `LinkedIn a répondu ${res.status} : ${(await res.text()).slice(0, 160)}` };
  const org = (await res.json()) as { localizedName?: string };
  return { ok: true, detail: `Page « ${org.localizedName ?? id} » accessible.` };
}

export async function testConnections(): Promise<Record<Platform, ConnectionTest>> {
  const status = connectionStatus();
  const run = async (p: Platform, fn: () => Promise<ConnectionTest>): Promise<ConnectionTest> => {
    if (!status[p].configured) return { ok: false, detail: "Pas encore relié." };
    try {
      return await fn();
    } catch (e) {
      return { ok: false, detail: `Injoignable : ${(e as Error).message}` };
    }
  };
  const [wordpress, facebook, linkedin] = await Promise.all([run("wordpress", testWordpress), run("facebook", testFacebook), run("linkedin", testLinkedin)]);
  return { wordpress, facebook, linkedin, tiktok: { ok: false, detail: status.tiktok.detail } };
}
