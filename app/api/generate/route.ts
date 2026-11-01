import { NextResponse } from "next/server";
import { generatePost, rewrite, draftWithoutAI, aiConfigured, type GenerateInput, type RewriteAction } from "@/lib/claude";
import { fetchArticle } from "@/lib/veille";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST { mode: "post", ...GenerateInput }  → textes pour toutes les plateformes
// POST { mode: "rewrite", action, text, platform } → texte réécrit
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.mode === "rewrite") {
      if (!aiConfigured()) {
        return NextResponse.json({ error: "L'assistant de réécriture a besoin de l'IA : ajoute GEMINI_API_KEY (gratuit) ou ANTHROPIC_API_KEY dans Vercel." }, { status: 400 });
      }
      const text = await rewrite(body.action as RewriteAction, String(body.text ?? ""), String(body.platform ?? ""));
      return NextResponse.json({ text });
    }
    const input = body as GenerateInput;
    let image = "";
    if (input.sourceUrl) {
      const art = await fetchArticle(input.sourceUrl).catch(() => ({ text: "", image: "" }));
      image = art.image;
      if (!input.articleText) input.articleText = art.text;
    }
    if (!aiConfigured()) {
      return NextResponse.json({
        image,
        generated: draftWithoutAI(input),
        notice: "Brouillon préparé sans IA : complète les passages entre crochets dans l'éditeur. Ajoute GEMINI_API_KEY (gratuit) ou ANTHROPIC_API_KEY dans Vercel pour la rédaction automatique.",
      });
    }
    try {
      const generated = await generatePost(input);
      return NextResponse.json({ generated, image });
    } catch (e) {
      // L'IA est indisponible (surcharge, quota…) : on propose quand même un brouillon prêt à compléter.
      return NextResponse.json({
        generated: draftWithoutAI(input),
        image,
        fallback: true,
        notice: `${(e as Error).message} En attendant, voici un brouillon prêt à compléter (passages entre crochets) ; tu peux aussi relancer l'IA.`,
      });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
