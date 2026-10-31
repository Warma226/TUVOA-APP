import { NextResponse } from "next/server";
import { storeImage } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX = 4 * 1024 * 1024; // limite des requêtes Vercel : 4,5 Mo

// POST (formulaire, champ « file ») → { url } de l'image enregistrée
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) return NextResponse.json({ error: "Aucune image reçue." }, { status: 400 });
    if (!TYPES.includes(file.type)) return NextResponse.json({ error: "Format accepté : PNG, JPG ou WebP." }, { status: 400 });
    if (file.size > MAX) return NextResponse.json({ error: "Image trop lourde (4 Mo maximum)." }, { status: 413 });
    const url = await storeImage(await file.arrayBuffer(), file.type);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
