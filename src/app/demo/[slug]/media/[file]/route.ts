import type { NextRequest } from "next/server";
import { MEDIA_FILE, readPhoto } from "@/demos/media";

// Fotos de la demo. Solo nombres generados por el código: nada de rutas que salgan de data/demo-media.
export async function GET(_req: NextRequest, ctx: RouteContext<"/demo/[slug]/media/[file]">) {
  const { slug, file } = await ctx.params;
  if (!/^[a-z0-9]{10}$/.test(slug) || !MEDIA_FILE.test(file)) return new Response("No encontrado", { status: 404 });
  try {
    return new Response(new Uint8Array(await readPhoto(slug, file)), { headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=86400" } });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
