// Lien signé vers le rendu PNG d'un visuel du Studio.
import { signParams, appUrl } from "./sign";
import type { StudioData } from "./studio";

export function studioUrl(d: StudioData, absolute = false): string {
  const p = new URLSearchParams();
  p.set("r", "studio");
  p.set("d", Buffer.from(JSON.stringify(d), "utf8").toString("base64url"));
  p.set("sig", signParams(p));
  return `${absolute ? appUrl() : ""}/api/visuel?${p.toString()}`;
}
