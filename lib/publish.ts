// Publication sur les canaux de TUVOA.
import type { Platform } from "./config";
import type { Post, PublishResult } from "./store";
import { visualUrl, formatFor } from "./visual-url";

type Publisher = (post: Post) => Promise<Omit<PublishResult, "at">>;

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

async function imageBytes(post: Post, platform: Platform): Promise<ArrayBuffer> {
  const url = visualUrl(post, formatFor(platform, post.rubrique), true);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Visuel indisponible (${res.status})`);
  return res.arrayBuffer();
}

function escapeHtml(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const wordpress: Publisher = async (post) => {
  const base = (process.env.WP_URL ?? "").replace(/\/$/, "");
  const auth = "Basic " + Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString("base64");
  // 1. Image à la une
  const bytes = await imageBytes(post, "wordpress");
  const media = await fetch(`${base}/wp-json/wp/v2/media`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "image/png", "Content-Disposition": `attachment; filename="tuvoa-${post.id.slice(0, 8)}.png"` },
    body: bytes,
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
    url: visualUrl(post, formatFor("facebook", post.rubrique), true),
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
    "LinkedIn-Version": process.env.LINKEDIN_VERSION || "202504",
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
  const up = await fetch(value.uploadUrl, { method: "PUT", headers: { Authorization: headers.Authorization }, body: await imageBytes(post, "linkedin") });
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
