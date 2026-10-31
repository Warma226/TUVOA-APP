import { NextResponse } from "next/server";
import { listPosts, getPost, savePost, deletePost, emptyPost, type Post } from "@/lib/store";
import { visualUrl, formatFor } from "@/lib/visual-url";
import { publishPost } from "@/lib/publish";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function withVisuals(post: Post) {
  const visuals: Record<string, string> = {};
  for (const p of ["facebook", "linkedin", "tiktok", "wordpress"]) visuals[p] = visualUrl(post, formatFor(p, post.rubrique));
  return { ...post, visuals };
}

// GET /api/posts → liste ; GET /api/posts?id=… → un post avec ses visuels
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const post = await getPost(id);
    if (!post) return NextResponse.json({ error: "Post introuvable" }, { status: 404 });
    return NextResponse.json({ post: withVisuals(post) });
  }
  const posts = await listPosts(60);
  return NextResponse.json({ posts });
}

// POST { action: "save", post } | { action: "schedule", id, at } | { action: "publish", id } | { action: "cancel", id } | { action: "delete", id }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.action === "save") {
      const existing = body.post?.id ? await getPost(body.post.id) : null;
      const post = { ...(existing ?? emptyPost()), ...body.post } as Post;
      return NextResponse.json({ post: withVisuals(await savePost(post)) });
    }
    const post = await getPost(String(body.id));
    if (!post) return NextResponse.json({ error: "Post introuvable" }, { status: 404 });
    if (body.action === "schedule") {
      const at = body.at ? new Date(body.at).toISOString() : new Date().toISOString();
      return NextResponse.json({ post: withVisuals(await savePost({ ...post, status: "planifie", scheduled_at: at })) });
    }
    if (body.action === "publish") {
      return NextResponse.json({ post: withVisuals(await savePost(await publishPost(post))) });
    }
    if (body.action === "cancel") {
      return NextResponse.json({ post: withVisuals(await savePost({ ...post, status: "annule", scheduled_at: null })) });
    }
    if (body.action === "delete") {
      await deletePost(post.id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
