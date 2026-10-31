// Construit les liens signés vers les visuels d'un post.
import { signParams, appUrl } from "./sign";
import type { Post } from "./store";
import type { VisualFormat } from "./visual";

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

export function formatFor(platform: string, rubrique: string): VisualFormat {
  if (platform === "tiktok") return "vertical";
  if (platform === "wordpress") return "paysage";
  if (platform === "linkedin" && rubrique === "actu") return "paysage";
  return "portrait";
}
