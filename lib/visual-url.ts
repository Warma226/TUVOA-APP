// Construit les liens signés vers les visuels d'un post.
import { signParams, appUrl } from "./sign";
import type { Post } from "./store";
import type { VisualFormat } from "./formats";

export function visualUrl(post: Pick<Post, "rubrique" | "visual" | "source_name">, format: VisualFormat, absolute = false): string {
  const p = new URLSearchParams();
  p.set("r", post.rubrique);
  p.set("f", format);
  p.set("t", post.visual.titre || "");
  p.set("x", post.visual.texte || "");
  if (post.visual.nom) p.set("n", post.visual.nom);
  if (post.visual.specialite) p.set("sp", post.visual.specialite);
  if (post.visual.photo) p.set("ph", post.visual.photo);
  if (post.source_name) p.set("src", post.source_name);
  p.set("sig", signParams(p));
  return `${absolute ? appUrl() : ""}/api/visuel?${p.toString()}`;
}

export { formatFor } from "./formats";
import { formatFor } from "./formats";

// Seule l'Actualité a un visuel généré. #CyberBase et #Portrait utilisent le visuel que tu fournis.
export function generatedRubrique(rubrique: string): boolean {
  return rubrique === "actu";
}

export function imageFor(post: Pick<Post, "rubrique" | "visual" | "source_name">, platform: string, absolute = false): string {
  if (!generatedRubrique(post.rubrique)) return post.visual.image ?? "";
  return visualUrl(post, formatFor(platform, post.rubrique), absolute);
}
