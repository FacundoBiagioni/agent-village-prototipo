// Ficha de marca desde la web propia del negocio: código común, sin IA (Vault: 02 Investigación/Fuentes para personalizar demos).
import { contrast, type Tokens } from "./directions";

export type Photo = { src: string; w: number; h: number; source: "web" | "manual" | "instagram" };
// fonts: id de FONT_PACKS que eligió el Diseñador o vos; siteFonts: fuentes de Google que usa su web (el Analista las anota para el Diseñador).
export type Brand = { color?: string; photos: Photo[]; instagram?: string; fonts?: string; siteFonts?: string[]; palette?: string };

export const MIN_PHOTO_WIDTH = 600; // más chicas no sirven ni para una tarjeta
export const HERO_WIDTH = 1200; // desde acá, la foto puede ir a pantalla completa

/** La foto del hero (si hay una ancha) o, si no, una foto mediana para un hero partido; el resto va a la galería.
 *  Sin fotos, el hero queda tipográfico (Plan B de la ficha). */
export function splitPhotos(brand?: Brand) {
  const photos = brand?.photos ?? [];
  const hero = photos.find((p) => p.w >= HERO_WIDTH);
  const side = hero ? undefined : photos[0];
  return { hero, side, gallery: photos.filter((p) => p !== hero && p !== side) };
}

const HEX = /^#[0-9a-f]{6}$/i;
const SKIP_IMG = /logo|icon|favicon|sprite|avatar|pixel|placeholder|whatsapp|facebook|instagram|\.svg|\.gif|^data:/i;

// WordPress mete sus propios estilos y su paleta por defecto en todas las páginas: no son la marca del negocio.
const WP_CORE_STYLE = /^<style[^>]*\bid=["'](wp-|global-styles|classic-theme|core-block)/i;
const WP_PALETTE = new Set(["#abb8c3", "#f78da7", "#cf2e2e", "#ff6900", "#fcb900", "#7bdcb5", "#00d084", "#8ed1fc", "#0693e3", "#9b51e0", "#32373c", "#007cba", "#006ba1", "#005a87", "#7a00df", "#313131"]);

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
const absolute = (ref: string, base: string) => {
  try {
    const u = new URL(ref.trim(), base);
    return /^https?:$/.test(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
};

/** Las URLs salen del HTML de un tercero: nunca bajar de la PC, la red local ni puertos raros.
 *  shortcut: mira el nombre, no la IP resuelta ni las redirecciones (no frena un DNS o un redirect a la red local); alcanza mientras la app corra solo en tu PC. */
export function isPublicUrl(u: string) {
  try {
    const { protocol, hostname: h, port } = new URL(u);
    if (!/^https?:$/.test(protocol) || (port && port !== "80" && port !== "443")) return false;
    return !/^(localhost|.*\.local|.*\.internal|0\.|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(h) && h.includes(".");
  } catch {
    return false;
  }
}

/** #abc → #aabbcc; cualquier otra cosa → null. */
export function normalizeHex(c: string | null | undefined) {
  const v = c?.trim().toLowerCase();
  if (!v) return null;
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${[...v.slice(1)].map((x) => x + x).join("")}`;
  return HEX.test(v) ? v : null;
}

/** Lo que sirve de la portada: color del tema, logo, fotos candidatas y colores usados en el HTML. */
export function extractBrand(html: string, pageUrl: string) {
  const metas = html.match(/<meta\b[^>]*>/gi) ?? [];
  const meta = (key: string) => metas.find((m) => attr(m, "name") === key || attr(m, "property") === key);
  const themeColor = normalizeHex(attr(meta("theme-color") ?? "", "content"));

  const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
  const logoTag = imgs.find((t) => /logo/i.test(t));
  const iconTag = (html.match(/<link\b[^>]*>/gi) ?? []).find((t) => /apple-touch-icon/i.test(attr(t, "rel") ?? ""));
  const logoUrl = absolute((logoTag && (attr(logoTag, "src") ?? attr(logoTag, "data-src"))) ?? (iconTag && attr(iconTag, "href")) ?? "", pageUrl);

  const og = attr(meta("og:image") ?? "", "content");
  const candidates = [og, ...imgs.filter((t) => !/logo/i.test(t)).map((t) => attr(t, "data-src") ?? attr(t, "src"))]
    .filter((s): s is string => !!s && !SKIP_IMG.test(s))
    .map((s) => absolute(s, pageUrl))
    .filter((s): s is string => !!s);
  const imageUrls = [...new Set(candidates)].slice(0, 10);

  // shortcut: solo colores escritos en el HTML (<style> y style=""), no las hojas de estilo enlazadas; sumarlas si quedan cortos.
  const counts = new Map<string, number>();
  for (const block of html.match(/<style\b[\s\S]*?<\/style>|\bstyle\s*=\s*"[^"]*"/gi) ?? []) {
    if (WP_CORE_STYLE.test(block)) continue;
    for (const m of block.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) ?? []) {
      const c = normalizeHex(m)!;
      if (!WP_PALETTE.has(c)) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  const cssColors = [...counts].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const instagram = (html.match(/href\s*=\s*["'][^"']*instagram\.com\/[^"']+/gi) ?? []).map((h) => instagramHandle(h.replace(/^href\s*=\s*["']/i, ""))).find(Boolean);
  // Fuentes de Google que carga su web (css2?family=Open+Sans:wght@400&family=Lora): sirven para elegir el pack.
  const fontFamilies = [...html.matchAll(/fonts\.googleapis\.com\/css2?\?[^"'\s>]+/gi)].flatMap((m) =>
    [...m[0].replace(/&amp;/g, "&").matchAll(/family=([^&]+)/g)].flatMap((f) => f[1].split(/\||%7C/i).map((x) => x.split(/:|%3A/i)[0].replace(/\+|%20/g, " ").trim())),
  );
  return { themeColor, logoUrl, imageUrls, cssColors, instagram, fontFamilies: [...new Set(fontFamilies)] };
}

const IG_RESERVED = new Set(["p", "reel", "reels", "tv", "explore", "stories", "accounts", "direct", "about", "legal", "developer"]);

/** Usuario de Instagram desde un link (instagram.com/usuario) o un "@usuario" escrito a mano; si no es un perfil, undefined. */
export function instagramHandle(ref: string | null | undefined) {
  const v = ref?.trim() ?? "";
  const m = v.match(/^@?([a-z0-9._]{1,30})$/i) ?? v.match(/^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/([a-z0-9._]{1,30})(?:[/?#]|$)/i);
  const h = m?.[1].toLowerCase();
  return h && !IG_RESERVED.has(h) && !/^\.|\.$|\.\./.test(h) ? h : undefined;
}

/** Un color sirve de marca si tiene color de verdad: ni gris, ni casi blanco, ni casi negro. */
export function isBrandish(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  return s >= 0.25 && l >= 0.15 && l <= 0.85;
}

/** Elige el color de marca: primero el del tema, después el del logo, después el más usado en la página. */
export function pickBrandColor(...candidates: (string | null | undefined)[]) {
  return candidates.map(normalizeHex).find((c): c is string => !!c && isBrandish(c));
}

/** El color de marca como acento, con texto encima que cumpla AA (4,5). Si no llega con blanco ni con negro, se oscurece. */
export function accentFor(color: string): Pick<Tokens, "accent" | "onAccent"> {
  if (contrast("#ffffff", color) >= 4.5) return { accent: color, onAccent: "#ffffff" };
  if (contrast("#111111", color) >= 4.5) return { accent: color, onAccent: "#111111" };
  let [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  let c = color;
  while (contrast("#ffffff", c) < 4.5) {
    [r, g, b] = [r, g, b].map((x) => Math.floor(x * 0.9));
    c = `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
  }
  return { accent: c, onAccent: "#ffffff" };
}

/** Tokens de la dirección con el color de la marca (si hay). */
export function withBrand(tokens: Tokens, brand?: Brand): Tokens {
  return brand?.color ? { ...tokens, ...accentFor(brand.color) } : tokens;
}

/** ¿robots.txt deja leer esta ruta? Grupo propio ("agentvillage") o, si no hay, el de "*". Gana la regla más larga. */
export function robotsAllows(robotsTxt: string, path: string, agent = "agentvillage") {
  const groups: { agents: string[]; rules: { allow: boolean; pattern: string }[] }[] = [];
  let current: (typeof groups)[number] | null = null;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const [k, ...rest] = raw.replace(/#.*/, "").split(":");
    const key = k.trim().toLowerCase(), value = rest.join(":").trim();
    if (key === "user-agent") {
      if (!current || current.rules.length) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
    } else if ((key === "allow" || key === "disallow") && current && value) {
      current.rules.push({ allow: key === "allow", pattern: value });
    }
  }
  const group = groups.find((g) => g.agents.some((a) => a !== "*" && agent.includes(a))) ?? groups.find((g) => g.agents.includes("*"));
  const matches = (group?.rules ?? []).filter((r) => new RegExp(`^${r.pattern.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}`).test(path));
  if (!matches.length) return true;
  const best = matches.reduce((a, b) => (b.pattern.length > a.pattern.length || (b.pattern.length === a.pattern.length && b.allow) ? b : a));
  return best.allow;
}
