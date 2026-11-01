import { ImageResponse } from "next/og";
import { renderVisual, FORMATS, type VisualFormat, type VisualData } from "@/lib/visual";
import { archivoFonts, montserratFonts } from "@/lib/fonts";
import { verifyParams, appUrl } from "@/lib/sign";
import { renderSlide, type SlideData } from "@/lib/recap-slides";

// Les photos d'articles sont chargées ici et passées en data URI : formats non pris en charge
// par le moteur de rendu (WebP, AVIF…) ou liens bloqués → l'emplacement reste sans photo au lieu de faire échouer l'image.
async function safeImage(url: string | null): Promise<string | undefined> {
  if (!url || !/^https?:\/\//.test(url)) return undefined;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; TUVOA/1.0)" }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return undefined;
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!["image/jpeg", "image/jpg", "image/png"].includes(type)) return undefined;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 6_000_000) return undefined;
    return `data:${type === "image/jpg" ? "image/jpeg" : type};base64,${buf.toString("base64")}`;
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
    };
  } else {
    data = { kind: "end", assets: appUrl() };
  }
  const fonts = [...(await montserratFonts()), ...(await archivoFonts())];
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
    rubrique: r === "cyberbase" || r === "portrait" ? r : "actu",
    titre: params.get("t") ?? "",
    texte: params.get("x") ?? "",
    nom: params.get("n") ?? undefined,
    specialite: params.get("sp") ?? undefined,
    photo: params.get("ph") ?? undefined,
    source: params.get("src") ?? undefined,
  };
  const { w, h } = FORMATS[format];
  const fonts = await archivoFonts();
  return new ImageResponse(renderVisual(data, format), {
    width: w,
    height: h,
    fonts: fonts.length ? fonts : undefined,
    headers: { "Cache-Control": "public, max-age=86400, immutable" },
  });
}
