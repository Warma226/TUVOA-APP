import { ImageResponse } from "next/og";
import { renderVisual, FORMATS, type VisualFormat, type VisualData } from "@/lib/visual";
import { archivoFonts } from "@/lib/fonts";
import { verifyParams } from "@/lib/sign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/visuel?r=cyberbase&f=portrait&t=Titre&x=Texte&sig=… → image PNG
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  if (!verifyParams(params)) return new Response("Lien de visuel invalide.", { status: 403 });

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
