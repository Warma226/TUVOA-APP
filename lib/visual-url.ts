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

// L'Actualité publie l'image de l'article, #CyberBase et #Portrait le visuel que tu fournis.
// #Citation : visuel généré à partir de la citation, de l'auteur et de sa photo (sauf si tu ajoutes ton propre visuel).
export function generatedRubrique(rubrique: string): boolean {
  return rubrique === "citation";
}

export function imageFor(post: Pick<Post, "rubrique" | "visual" | "source_name">, platform: string, absolute = false): string {
  if (post.rubrique === "citation" && !post.visual.image) return visualUrl(post, formatFor(platform, post.rubrique), absolute);
  return post.visual.image ?? "";
}
