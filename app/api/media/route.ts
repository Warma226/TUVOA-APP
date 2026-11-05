import { verifyParams } from "@/lib/sign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/media?u=<image>&sig=… → l'image en JPEG (1080 px de large au plus), pour TikTok.
// Lien signé : seules les images préparées par TUVOA sont servies.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  if (!verifyParams(params)) return new Response("Lien invalide.", { status: 403 });
  const src = params.get("u") ?? "";
  const r = await fetch(src, { headers: { "User-Agent": "TUVOA-APP/1.0" } });
  if (!r.ok) return new Response("Image indisponible.", { status: 502 });
  const sharp = (await import("sharp")).default;
  const jpg = await sharp(Buffer.from(await r.arrayBuffer())).rotate().resize({ width: 1080, withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 85 }).toBuffer();
  return new Response(new Uint8Array(jpg), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" } });
}
