import { NextResponse } from "next/server";
import { testConnections } from "@/lib/publish";
import { chargerJetonFb } from "@/lib/fb-jeton";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET → vérifie chaque compte relié, sans rien publier.
export async function GET() {
  await chargerJetonFb();
  return NextResponse.json({ results: await testConnections() });
}
