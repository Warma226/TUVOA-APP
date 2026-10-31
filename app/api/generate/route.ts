import { NextResponse } from "next/server";
import { generatePost, rewrite, draftWithoutAI, aiConfigured, type GenerateInput, type RewriteAction } from "@/lib/claude";
import { fetchArticleText } from "@/lib/veille";

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
    if (!aiConfigured()) {
      return NextResponse.json({
        generated: draftWithoutAI(input),
        notice: "Brouillon préparé sans IA : complète les passages entre crochets dans l'éditeur. Ajoute GEMINI_API_KEY (gratuit) ou ANTHROPIC_API_KEY dans Vercel pour la rédaction automatique.",
      });
    }
    if (input.sourceUrl && !input.articleText) input.articleText = await fetchArticleText(input.sourceUrl);
    const generated = await generatePost(input);
    return NextResponse.json({ generated });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
