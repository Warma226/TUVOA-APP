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
      configured: Boolean(process.env.LINKEDIN_WEBHOOK_URL || (process.env.LINKEDIN_TOKEN && process.env.LINKEDIN_AUTHOR)),
      detail: process.env.LINKEDIN_WEBHOOK_URL ? "Page TUVOA via Make" : process.env.LINKEDIN_AUTHOR ?? "LINKEDIN_WEBHOOK_URL (Make)",
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

// ─── WordPress : article complet (catégories, étiquettes, extrait SEO, images légendées) ───
function wpAuth() {
  return "Basic " + Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString("base64");
}
function wpBase() {
  return (process.env.WP_URL ?? "").replace(/\/$/, "");
}
const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// Identifiants des catégories (par nom, sans accents ni casse) : seules les catégories existantes sont utilisées.
async function wpCategoryIds(names: string[]): Promise<number[]> {
  if (!names.length) return [];
  const res = await fetch(`${wpBase()}/wp-json/wp/v2/categories?per_page=100`, { headers: { Authorization: wpAuth() } });
  if (!res.ok) return [];
  const all = (await res.json()) as { id: number; name: string; slug: string }[];
  return names.map((n) => all.find((c) => norm(c.name) === norm(n) || c.slug === norm(n).replace(/\s+/g, "-"))?.id).filter((x): x is number => typeof x === "number");
}
// Étiquettes : créées si elles n'existent pas encore.
async function wpTagIds(names: string[]): Promise<number[]> {
  const ids: number[] = [];
  for (const name of names.slice(0, 8)) {
    const q = await fetch(`${wpBase()}/wp-json/wp/v2/tags?search=${encodeURIComponent(name)}&per_page=20`, { headers: { Authorization: wpAuth() } });
    const found = q.ok ? ((await q.json()) as { id: number; name: string }[]).find((t) => norm(t.name) === norm(name)) : undefined;
    if (found) { ids.push(found.id); continue; }
    const c = await fetch(`${wpBase()}/wp-json/wp/v2/tags`, { method: "POST", headers: { Authorization: wpAuth(), "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    if (c.ok) ids.push(((await c.json()) as { id: number }).id);
  }
  return ids;
}
// Envoie une image dans la médiathèque avec sa légende et son texte alternatif.
async function wpMedia(url: string, name: string, legende: string, alt: string): Promise<{ id: number; src: string } | null> {
  const r = await fetch(url);
  if (!r.ok) return null;
  const type = (r.headers.get("content-type") ?? "image/jpeg").split(";")[0];
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  const up = await fetch(`${wpBase()}/wp-json/wp/v2/media`, {
    method: "POST",
    headers: { Authorization: wpAuth(), "Content-Type": type, "Content-Disposition": `attachment; filename="${name}.${ext}"` },
    body: await r.arrayBuffer(),
  });
  if (!up.ok) throw new Error(`WordPress (image) ${up.status} : ${(await up.text()).slice(0, 200)}`);
  const m = (await up.json()) as { id: number; source_url: string };
  await fetch(`${wpBase()}/wp-json/wp/v2/media/${m.id}`, {
    method: "POST",
    headers: { Authorization: wpAuth(), "Content-Type": "application/json" },
    body: JSON.stringify({ caption: legende, alt_text: alt, title: alt }),
  });
  return { id: m.id, src: m.source_url };
}
const figure = (src: string, alt: string, legende: string) =>
  `<!-- wp:image {"sizeSlug":"large"} -->\n<figure class="wp-block-image size-large"><img src="${src}" alt="${escapeHtml(alt)}"/><figcaption class="wp-element-caption">${escapeHtml(legende)}</figcaption></figure>\n<!-- /wp:image -->`;
const slugify = (t: string) => norm(t).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);

const wordpress: Publisher = async (post) => {
  const v = post.visual;
  const titre = post.texts.wp_title || post.title;
  const slug = post.id.slice(0, 8);
  // 1. Image à la une (légendée) puis images de l'article
  const une = imageFor(post, "wordpress", true);
  if (!une) throw new Error("Aucun visuel : ajoute l'image de l'article dans l'éditeur.");
  const legendeUne = v.legende || (post.source_name ? `Illustration · ${post.source_name}` : titre);
  const altUne = v.alt || titre;
  const media = await wpMedia(une, `tuvoa-${slug}`, legendeUne, altUne);
  let content = post.texts.wp_body || `<p>${escapeHtml(post.texts.facebook)}</p>`;
  const extras = v.wp_images ?? [];
  for (let i = 0; i < extras.length; i++) {
    const im = extras[i];
    const m = await wpMedia(im.url, `tuvoa-${slug}-${i + 1}`, im.legende, im.alt || im.legende).catch(() => null);
    const html = m ? figure(m.src, im.alt || im.legende, im.legende) : "";
    content = content.includes(`[[IMAGE${i + 1}]]`) ? content.replace(`[[IMAGE${i + 1}]]`, html) : content + html;
  }
  content = content.replace(/\[\[IMAGE\d+\]\]/g, "");
  if (post.source_url && !content.includes(post.source_url)) {
    content += `<p>Source : <a href="${post.source_url}" rel="noopener">${escapeHtml(post.source_name ?? post.source_url)}</a></p>`;
  }
  // 2. Catégories, étiquettes, extrait (méta-description) et adresse lisible
  const categories = await wpCategoryIds(v.wp_categories ?? []);
  const tags = await wpTagIds(v.wp_tags ?? []);
  const excerpt = post.texts.wp_excerpt || "";
  const res = await fetch(`${wpBase()}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: { Authorization: wpAuth(), "Content-Type": "application/json" },
    // Post de test de connexion : envoyé en brouillon, jamais publié en ligne.
    body: JSON.stringify({
      title: titre,
      content,
      excerpt,
      slug: v.wp_slug || slugify(titre),
      status: post.origin === "test" ? "draft" : "publish",
      ...(media ? { featured_media: media.id } : {}),
      ...(categories.length ? { categories } : {}),
      ...(tags.length ? { tags } : {}),
    }),
  });
  if (!res.ok) throw new Error(`WordPress ${res.status} : ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { link?: string };
  return { ok: true, detail: post.origin === "test" ? "Brouillon de test créé (non publié)" : "Article publié", url: json.link };
};

// Carrousel (plusieurs images à faire défiler) : chaque image est d'abord envoyée sans être publiée,
// puis un seul post les regroupe avec le texte.
async function facebookCarousel(post: Post, slides: string[]) {
  const version = process.env.FB_GRAPH_VERSION || "v21.0";
  const token = process.env.FB_PAGE_TOKEN ?? "";
  const ids: string[] = [];
  for (const url of slides.slice(0, 10)) {
    const res = await fetch(`https://graph.facebook.com/${version}/${process.env.FB_PAGE_ID}/photos`, {
      method: "POST",
      body: new URLSearchParams({ url, published: "false", access_token: token }),
    });
    const json = (await res.json()) as { id?: string; error?: { message: string } };
    if (!res.ok || json.error || !json.id) throw new Error(`Facebook (image ${ids.length + 1}) : ${json.error?.message ?? res.status}`);
    ids.push(json.id);
  }
  const body = new URLSearchParams({ message: post.texts.facebook, access_token: token });
  ids.forEach((id, i) => body.set(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })));
  const res = await fetch(`https://graph.facebook.com/${version}/${process.env.FB_PAGE_ID}/feed`, { method: "POST", body });
  const json = (await res.json()) as { id?: string; error?: { message: string } };
  if (!res.ok || json.error) throw new Error(`Facebook : ${json.error?.message ?? res.status}`);
  return { ok: true, detail: `Carrousel de ${ids.length} images publié sur la Page`, url: json.id ? `https://www.facebook.com/${json.id}` : undefined };
}

const facebook: Publisher = async (post) => {
  if (post.visual.slides && post.visual.slides.length > 1) return facebookCarousel(post, post.visual.slides);
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

// Données envoyées à Make (scénario : Webhook → HTTP « Get a file » → LinkedIn « Create an Organization Image Post »).
export function linkedinPayload(post: Post, test = false) {
  return {
    test,
    post_id: post.id,
    text: post.texts.linkedin,
    image_url: imageFor(post, "linkedin", true),
    title: post.title || post.visual.titre,
    source_url: post.source_url ?? "",
  };
}

const linkedinViaMake: Publisher = async (post) => {
  const payload = linkedinPayload(post);
  if (!payload.image_url) throw new Error("Aucun visuel : ajoute le lien de ton visuel dans l'éditeur.");
  const res = await fetch(process.env.LINKEDIN_WEBHOOK_URL as string, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Make a répondu ${res.status} : ${(await res.text()).slice(0, 200)}. Vérifie que le scénario est activé.`);
  return { ok: true, detail: "Envoyé à Make pour publication sur la Page LinkedIn" };
};

const linkedin: Publisher = async (post) => {
  // Page TUVOA via Make (aucune validation LinkedIn nécessaire) si le webhook est configuré.
  if (process.env.LINKEDIN_WEBHOOK_URL) return linkedinViaMake(post);
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
  const hook = process.env.LINKEDIN_WEBHOOK_URL;
  if (hook) {
    let host = "";
    try {
      host = new URL(hook).hostname;
    } catch {
      return { ok: false, detail: "LINKEDIN_WEBHOOK_URL n'est pas une adresse valide." };
    }
    if (!/(^|\.)make\.com$/.test(host)) return { ok: false, detail: "LINKEDIN_WEBHOOK_URL doit être l'adresse du webhook Make (…make.com)." };
    return { ok: true, detail: "Webhook Make configuré. Pour ne rien publier, il n'est pas appelé pendant le test." };
  }
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
