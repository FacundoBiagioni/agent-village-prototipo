import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { extractBrand, isPublicUrl, MIN_PHOTO_WIDTH, pickBrandColor, robotsAllows, type Brand, type Photo } from "./brand";

// Fotos de las demos: en disco (data/ no va a git), servidas por /demo/[slug]/media/[file].
const DIR = join(process.cwd(), "data", "demo-media");
const UA = "Mozilla/5.0 (compatible; AgentVillage/0.1; demo para el negocio)";
const MAX_BYTES = 10_000_000;
export const MEDIA_FILE = /^[0-9a-f]{16}\.webp$/;

export const mediaPath = (slug: string, file: string) => join(DIR, slug, file);

/** Achica a 1600 px de ancho, pasa a WebP y guarda. Devuelve null si no es una imagen o es muy chica. */
export async function savePhoto(slug: string, input: Buffer, source: Photo["source"]): Promise<Photo | null> {
  try {
    const { data, info } = await sharp(input).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
    if (info.width < MIN_PHOTO_WIDTH) return null;
    const file = `${randomBytes(8).toString("hex")}.webp`;
    await mkdir(join(DIR, slug), { recursive: true });
    await writeFile(mediaPath(slug, file), data);
    return { src: `/demo/${slug}/media/${file}`, w: info.width, h: info.height, source };
  } catch {
    return null; // no era una imagen válida
  }
}

export async function deletePhoto(src: string) {
  const m = src.match(/^\/demo\/([a-z0-9]{10})\/media\/([0-9a-f]{16}\.webp)$/);
  if (m) await unlink(mediaPath(m[1], m[2])).catch(() => {});
}

export const readPhoto = (slug: string, file: string) => readFile(mediaPath(slug, file));

/** Baja una imagen de la web del negocio, con tiempo y tamaño máximos. */
export async function download(url: string) {
  if (!isPublicUrl(url)) return null;
  const r = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { "User-Agent": UA } });
  if (!r.ok || !/^image\//.test(r.headers.get("content-type") ?? "") || Number(r.headers.get("content-length") ?? 0) > MAX_BYTES) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  return buf.length > MAX_BYTES ? null : buf;
}

/** Color dominante del logo. shortcut: si el logo es casi todo fondo blanco, sale blanco y se descarta (pickBrandColor). */
export async function dominantColor(buf: Buffer) {
  const { dominant: d } = await sharp(buf).stats();
  return `#${[d.r, d.g, d.b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/** Lee la portada del negocio (si robots.txt lo permite) y arma su ficha de marca. El HTML vuelve para sacar los textos. */
export async function collectFromSite(siteUrl: string, slug: string): Promise<{ html: string; brand: Brand; instagram?: string; fontFamilies: string[] } | null> {
  const url = new URL(siteUrl.includes("://") ? siteUrl : `http://${siteUrl}`);
  const robots = await fetch(new URL("/robots.txt", url), { signal: AbortSignal.timeout(10_000), headers: { "User-Agent": UA } })
    .then((r) => (r.ok ? r.text() : ""))
    .catch(() => "");
  const allowed = (u: string) => new URL(u).host !== url.host || robotsAllows(robots, new URL(u).pathname);
  if (!isPublicUrl(url.href) || !allowed(url.href)) return null;

  const r = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { "User-Agent": UA } });
  if (!r.ok) return null;
  const html = (await r.text()).slice(0, 1_000_000);
  const found = extractBrand(html, r.url);

  const logo = found.logoUrl && allowed(found.logoUrl) ? await download(found.logoUrl).catch(() => null) : null;
  const logoColor = logo ? await dominantColor(logo).catch(() => null) : null;

  const photos: Photo[] = [];
  for (const src of found.imageUrls.filter(allowed)) {
    if (photos.length >= 6) break;
    const buf = await download(src).catch(() => null);
    const photo = buf && (await savePhoto(slug, buf, "web"));
    if (photo) photos.push(photo);
  }
  // Primero la más ancha: es la candidata al hero.
  photos.sort((a, b) => b.w - a.w);
  return { html, instagram: found.instagram, fontFamilies: found.fontFamilies, brand: { color: pickBrandColor(found.themeColor, logoColor, ...found.cssColors), photos } };
}

const DAY = 86_400_000;

/** Archivos que ninguna demo usa, con más de un día (los más nuevos pueden ser de una demo que se está armando). */
export function findOrphans(files: { src: string; mtimeMs: number }[], used: Set<string>, now = Date.now()) {
  return files.filter((f) => !used.has(f.src) && now - f.mtimeMs > DAY).map((f) => f.src);
}

/** Borra las fotos de demos que fallaron o se borraron, y las que se quitaron en Editar sin llegar a guardarse. */
export async function cleanOrphanPhotos(used: Set<string>) {
  const files: { src: string; mtimeMs: number }[] = [];
  for (const slug of await readdir(DIR).catch(() => [] as string[])) {
    for (const file of await readdir(join(DIR, slug)).catch(() => [] as string[])) {
      if (MEDIA_FILE.test(file)) files.push({ src: `/demo/${slug}/media/${file}`, mtimeMs: (await stat(mediaPath(slug, file))).mtimeMs });
    }
  }
  const orphans = findOrphans(files, used);
  await Promise.all(orphans.map(deletePhoto));
  // Carpetas que quedaron vacías.
  for (const slug of await readdir(DIR).catch(() => [] as string[])) {
    if (!(await readdir(join(DIR, slug)).catch(() => ["x"])).length) await rm(join(DIR, slug), { recursive: true });
  }
  return { revisadas: files.length, borradas: orphans.length };
}
