import { NextResponse } from "next/server";
import { emptyPost } from "@/lib/store";
import { linkedinPayload } from "@/lib/publish";

export const dynamic = "force-dynamic";

// POST → envoie un exemple (test: true) au webhook Make, pour que Make apprenne la structure des données.
// À utiliser pendant « Redetermine data structure » : le scénario n'est alors pas exécuté, rien n'est publié.
export async function POST() {
  const hook = process.env.LINKEDIN_WEBHOOK_URL;
  if (!hook) return NextResponse.json({ error: "Ajoute d'abord LINKEDIN_WEBHOOK_URL dans Vercel." }, { status: 400 });
  const exemple = emptyPost({
    rubrique: "actu",
    title: "Exemple TUVOA Studio",
    texts: { facebook: "", linkedin: "Exemple de post envoyé par TUVOA Studio pour configurer Make.", tiktok: "", wp_title: "", wp_body: "" },
    visual: { titre: "Exemple", texte: "Exemple de visuel TUVOA" },
  });
  const res = await fetch(hook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(linkedinPayload(exemple, true)),
    signal: AbortSignal.timeout(20000),
  }).catch((e: Error) => ({ ok: false, status: 0, text: async () => e.message }) as unknown as Response);
  if (!res.ok) return NextResponse.json({ error: `Make a répondu ${res.status || "—"} : ${(await res.text()).slice(0, 160)}` }, { status: 502 });
  return NextResponse.json({ ok: true });
}
