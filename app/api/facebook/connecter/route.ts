// Démarre la reconnexion de la Page Facebook : renvoie vers la fenêtre officielle de Facebook.
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { appUrl } from "@/lib/sign";
import { FB_APP_ID, FB_CONFIG_ID, SCOPES, etatOAuth } from "@/lib/fb-jeton";

export const dynamic = "force-dynamic";

export async function GET() {
  const uid = (await headers()).get("x-tuvoa-uid") || "admin";
  const u = new URL(`https://www.facebook.com/${process.env.FB_GRAPH_VERSION || "v21.0"}/dialog/oauth`);
  u.searchParams.set("client_id", FB_APP_ID());
  u.searchParams.set("redirect_uri", `${appUrl()}/api/facebook/retour`);
  u.searchParams.set("state", etatOAuth(uid));
  u.searchParams.set("response_type", "code");
  if (FB_CONFIG_ID()) u.searchParams.set("config_id", FB_CONFIG_ID());
  else u.searchParams.set("scope", SCOPES.join(","));
  return NextResponse.redirect(u.toString());
}
