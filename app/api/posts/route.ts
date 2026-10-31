import { NextResponse } from "next/server";
import { listPosts, getPost, savePost, deletePost, emptyPost, isDemo, type Post } from "@/lib/store";
import { imageFor } from "@/lib/visual-url";
import { publishPost } from "@/lib/publish";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function withVisuals(post: Post) {
  const visuals: Record<string, string> = {};
  for (const p of ["facebook", "linkedin", "tiktok", "wordpress"]) visuals[p] = imageFor(post, p);
  return { ...post, visuals };
}

function normalize(input: Partial<Post> | undefined): Post {
  const base = emptyPost();
  const p = { ...base, ...(input ?? {}) } as Post;
  return { ...p, texts: { ...base.texts, ...(input?.texts ?? {}) }, visual: { ...base.visual, ...(input?.visual ?? {}) }, results: input?.results ?? {} };
}

// GET /api/posts → liste ; GET /api/posts?id=… → un post avec ses visuels
export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (id) {
      const post = await getPost(id);
      if (!post) return NextResponse.json({ error: "Post introuvable" }, { status: 404 });
      return NextResponse.json({ post: withVisuals(post) });
    }
    return NextResponse.json({ posts: await listPosts(60) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST { action: "save", post } | { action: "visuals", post } | { action: "schedule", id, at, post? }
//      | { action: "publish", id, post? } | { action: "cancel", id, post? } | { action: "delete", id }
// En mode démo (sans Supabase), le navigateur garde les posts et envoie le post complet à chaque action.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const demo = isDemo();

    if (body.action === "visuals") return NextResponse.json({ post: withVisuals(normalize(body.post)) });

    if (body.action === "save") {
      const existing = !demo && body.post?.id ? await getPost(body.post.id) : null;
      const merged = normalize({ ...(existing ?? {}), ...(body.post ?? {}) });
      const saved = demo ? merged : await savePost(merged);
      return NextResponse.json({ post: withVisuals(saved) });
    }

    if (body.action === "delete") {
      if (!demo) await deletePost(String(body.id));
      return NextResponse.json({ ok: true });
    }

    const post = demo && body.post ? normalize(body.post) : await getPost(String(body.id));
    if (!post) return NextResponse.json({ error: "Post introuvable" }, { status: 404 });
    const keep = async (p: Post) => (demo ? p : await savePost(p));

    if (body.action === "schedule") {
      const at = body.at ? new Date(body.at).toISOString() : new Date().toISOString();
      return NextResponse.json({ post: withVisuals(await keep({ ...post, status: "planifie", scheduled_at: at })) });
    }
    if (body.action === "publish") {
      return NextResponse.json({ post: withVisuals(await keep(await publishPost(post))) });
    }
    if (body.action === "cancel") {
      return NextResponse.json({ post: withVisuals(await keep({ ...post, status: "annule", scheduled_at: null })) });
    }
    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
