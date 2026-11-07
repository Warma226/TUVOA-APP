// GET /api/logo?d=thehackernews.com → le logo officiel du média (icône déclarée par son site), en PNG carré.
// Ordre : apple-touch-icon et icônes déclarées dans la page d'accueil (la plus grande d'abord), puis /apple-touch-icon.png, puis /favicon.ico.
// Réponse mise en cache 7 jours ; 404 si rien n'est trouvé (l'app affiche alors les initiales).
export const runtime = "nodejs";
export const maxDuration = 20;

const UA = "Mozilla/5.0 (compatible; TUVOA-APP/1.0; +https://tuvoa.media)";
const DOMAINE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

async function chercher(url: string, ms: number): Promise<Response | null> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" }, redirect: "follow", signal: AbortSignal.timeout(ms) });
    return r.ok ? r : null;
  } catch {
    return null;
  }
}

// Icônes déclarées dans le <head> : <link rel="icon|apple-touch-icon" href sizes>
function iconesDeclarees(html: string, base: string): string[] {
  const out: { url: string; score: number }[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const rel = /\brel\s*=\s*["']?([^"'>]+)/i.exec(tag)?.[1]?.toLowerCase() ?? "";
    if (!/\b(icon|apple-touch-icon(-precomposed)?|mask-icon)\b/.test(rel) || /mask-icon/.test(rel)) continue;
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ?? /\bhref\s*=\s*([^\s>]+)/i.exec(tag)?.[1];
    if (!href || href.startsWith("data:")) continue;
    let url: string;
    try { url = new URL(href.replace(/&amp;/g, "&"), base).toString(); } catch { continue; }
    const taille = Math.max(0, ...((/\bsizes\s*=\s*["']?([^"'>]+)/i.exec(tag)?.[1] ?? "").match(/\d+/g) ?? []).map(Number));
    const svg = /\.svg(\?|$)/i.test(url) || /image\/svg/i.test(tag);
    const score = (rel.includes("apple-touch-icon") ? 180 : 0) + (svg ? 256 : 0) + Math.min(taille, 512);
    out.push({ url, score: score || 16 });
  }
  return out.sort((a, b) => b.score - a.score).map((x) => x.url);
}

async function image(url: string): Promise<{ bytes: Buffer; type: string } | null> {
  const r = await chercher(url, 6000);
  if (!r) return null;
  const type = (r.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const bytes = Buffer.from(await r.arrayBuffer());
  if (bytes.length < 60 || bytes.length > 3_000_000) return null;
  const ico = type.includes("icon") || /\.ico(\?|$)/i.test(url);
  if (!ico && !type.startsWith("image/")) return null;
  if (ico) return { bytes, type: "image/x-icon" }; // sharp ne lit pas les .ico : le navigateur, si
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(bytes, { density: 300 }).metadata();
    if (!meta.width || meta.width < 16) return null;
    const png = await sharp(bytes, { density: 300 }).resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    return { bytes: png, type: "image/png" };
  } catch {
    return { bytes, type };
  }
}

export async function GET(req: Request) {
  const d = (new URL(req.url).searchParams.get("d") ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!DOMAINE.test(d) || /^\d+(\.\d+)+$/.test(d)) return new Response("Domaine invalide.", { status: 400 });

  const hotes = d.startsWith("www.") ? [d, d.slice(4)] : [d, `www.${d}`];
  const candidats: string[] = [];
  for (const h of hotes) {
    const page = await chercher(`https://${h}/`, 6000);
    if (!page) continue;
    const html = (await page.text()).slice(0, 400_000);
    candidats.push(...iconesDeclarees(html, page.url || `https://${h}/`));
    break;
  }
  candidats.push(`https://${hotes[0]}/apple-touch-icon.png`, `https://${hotes[0]}/favicon.ico`, `https://${hotes[1]}/favicon.ico`);

  const vus = new Set<string>();
  for (const url of candidats) {
    if (vus.has(url)) continue;
    vus.add(url);
    const img = await image(url);
    if (img) {
      return new Response(new Uint8Array(img.bytes), {
        headers: { "Content-Type": img.type, "Cache-Control": "public, max-age=604800, s-maxage=2592000, stale-while-revalidate=604800" },
      });
    }
    if (vus.size >= 6) break;
  }
  return new Response("Logo introuvable.", { status: 404, headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" } });
}
