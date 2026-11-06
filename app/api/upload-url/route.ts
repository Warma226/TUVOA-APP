import { NextResponse } from "next/server";
import { signedUpload } from "@/lib/storage";

export const dynamic = "force-dynamic";

// POST { type, ext } → { signedUrl, publicUrl } : le navigateur envoie lui-même le fichier (vidéo du Studio).
export async function POST(req: Request) {
  try {
    const { type, ext } = (await req.json()) as { type?: string; ext?: string };
    return NextResponse.json(await signedUpload(type ?? "", ext ?? ""));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
