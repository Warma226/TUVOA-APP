import { ImageResponse } from "next/og";
import { renderVisual, FORMATS, type VisualFormat, type VisualData } from "@/lib/visual";
import { archivoFonts, montserratFonts, serifItalicFonts } from "@/lib/fonts";
import { verifyParams, appUrl } from "@/lib/sign";
import { renderSlide, type SlideData } from "@/lib/recap-slides";

// Les photos d'articles sont chargées ici et passées en data URI. WebP, AVIF, GIF sont convertis en JPEG
// (le moteur de rendu ne les lit pas) ; lien bloqué → l'emplacement reste sans photo au lieu de faire échouer l'image.
async function safeImage(url: string | null): Promise<string | undefined> {
  if (!url || !/^https?:\/\//.test(url)) return undefined;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; TUVOA/1.0)" }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return undefined;
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 12_000_000) return undefined;
    if (["image/jpeg", "image/jpg", "image/png"].includes(type) && buf.length <= 6_000_000) {
      return `data:${type === "image/jpg" ? "image/jpeg" : type};base64,${buf.toString("base64")}`;
    }
    // WebP, AVIF, GIF… (ou type mal déclaré) : converti en JPEG pour le moteur de rendu.
    const sharp = (await import("sharp")).default;
    const jpg = await sharp(buf, { animated: false }).rotate().resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    return `data:image/jpeg;base64,${jpg.toString("base64")}`;
  } catch {
    return undefined;
  }
}

async function recap(params: URLSearchParams) {
  const k = params.get("k");
  let data: SlideData;
  if (k === "cover") {
    const photos = await Promise.all(Array.from({ length: 8 }, (_, i) => safeImage(params.get(`p${i}`))));
    data = {
      kind: "cover",
      periode: params.get("per") ?? "",
      count: Number(params.get("n") ?? 5),
      photos: photos.map((p) => p ?? ""),
      categories: Array.from({ length: 8 }, (_, i) => params.get(`c${i}`) ?? ""),
      assets: appUrl(),
    };
  } else if (k === "item") {
    data = {
      kind: "item",
      index: Number(params.get("i") ?? 1),
      total: Number(params.get("tot") ?? 5),
      categorie: params.get("cat") ?? "",
      texte: params.get("x") ?? "",
      photo: await safeImage(params.get("ph")),
      source: params.get("src") ?? undefined,
      autres: await Promise.all(
        Array.from({ length: 4 }, async (_, i) => ({ photo: await safeImage(params.get(`ap${i}`)), categorie: params.get(`ac${i}`) ?? "Actu tech" }))
      ),
    };
  } else {
    data = { kind: "end", assets: appUrl() };
  }
  const fonts = [...(await montserratFonts()), ...(await serifItalicFonts()), ...(await archivoFonts())];
  return new ImageResponse(renderSlide(data), {
    width: 1080,
    height: 1350,
    fonts: fonts.length ? fonts : undefined,
    headers: { "Cache-Control": "public, max-age=86400, immutable" },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/visuel?r=cyberbase&f=portrait&t=Titre&x=Texte&sig=… → image PNG
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  if (!verifyParams(params)) return new Response("Lien de visuel invalide.", { status: 403 });
  if (params.get("r") === "recap") return recap(params);

  const f = (params.get("f") as VisualFormat) || "portrait";
  const format: VisualFormat = f in FORMATS ? f : "portrait";
  const r = params.get("r");
  const data: VisualData = {
    rubrique: r === "cyberbase" || r === "portrait" || r === "citation" ? r : "actu",
    titre: params.get("t") ?? "",
    texte: params.get("x") ?? "",
    nom: params.get("n") ?? undefined,
    specialite: params.get("sp") ?? undefined,
    photo: params.get("ph") ?? undefined,
    source: params.get("src") ?? undefined,
  };
  // Citation : photo chargée ici (formats non pris en charge → visuel sans photo), police Montserrat.
  if (data.rubrique === "citation") data.photo = await safeImage(data.photo ?? null);
  const { w, h } = FORMATS[format];
  const fonts = data.rubrique === "citation" ? [...(await montserratFonts()), ...(await archivoFonts())] : await archivoFonts();
  return new ImageResponse(renderVisual(data, format), {
    width: w,
    height: h,
    fonts: fonts.length ? fonts : undefined,
    headers: { "Cache-Control": "public, max-age=86400, immutable" },
  });
}
