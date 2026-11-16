// Instagram del negocio por la API oficial (Business Discovery): solo cuentas públicas de empresa o creador.
// Gratis; el token de 60 días se renueva con tools/meta/ig-token.mjs (Vault: 02 Investigación/Fuentes para personalizar demos).
import type { Photo } from "./brand";
import { dominantColor, download, savePhoto } from "./media";

const FIELDS = "username,name,biography,website,profile_picture_url,media.limit(12){media_type,media_url}";

type Discovery = {
  username?: string;
  name?: string;
  biography?: string;
  website?: string;
  profile_picture_url?: string;
  media?: { data: { media_type: string; media_url?: string }[] };
};

export const instagramEnabled = () => !!(process.env.META_USER_TOKEN && process.env.META_IG_USER_ID);

/** Biografía, web, color de la foto de perfil y hasta `maxPhotos` fotos guardadas para la demo. Los videos no se usan. */
/** `verify`: para un usuario encontrado por la búsqueda (no cargado por el negocio), confirma que la cuenta sea suya antes de bajar nada. */
export async function collectFromInstagram(handle: string, slug: string, maxPhotos: number, verify?: (p: { username: string; name: string | null; bio: string | null }) => boolean) {
  const { META_USER_TOKEN, META_IG_USER_ID } = process.env;
  if (!META_USER_TOKEN || !META_IG_USER_ID) throw new Error("Instagram sin configurar (META_USER_TOKEN y META_IG_USER_ID en .env)");
  const params = new URLSearchParams({ fields: `business_discovery.username(${handle}){${FIELDS}}`, access_token: META_USER_TOKEN });
  const r = await fetch(`https://graph.facebook.com/${META_IG_USER_ID}?${params}`, { signal: AbortSignal.timeout(20_000) });
  const body = (await r.json()) as { business_discovery?: Discovery; error?: { message: string; code: number } };
  // El mensaje de Meta nunca trae el token; 110 = cuenta personal o inexistente, 190 = token vencido.
  if (body.error) throw new Error(`Instagram @${handle}: ${body.error.message} (código ${body.error.code})`);
  const d = body.business_discovery ?? {};
  if (verify && !verify({ username: d.username ?? handle, name: d.name ?? null, bio: d.biography ?? null }))
    throw new Error(`Instagram @${handle}: la cuenta que encontró la búsqueda no parece ser de este negocio (no se usó)`);

  const avatar = d.profile_picture_url ? await download(d.profile_picture_url).catch(() => null) : null;
  const color = avatar ? await dominantColor(avatar).catch(() => null) : null;

  const photos: Photo[] = [];
  for (const m of d.media?.data ?? []) {
    if (photos.length >= maxPhotos) break;
    if (m.media_type === "VIDEO" || !m.media_url) continue; // en un carrusel, media_url es su primera foto
    const buf = await download(m.media_url).catch(() => null);
    const photo = buf && (await savePhoto(slug, buf, "instagram"));
    if (photo) photos.push(photo);
  }
  return { bio: d.biography ?? null, website: d.website ?? null, color, photos };
}
