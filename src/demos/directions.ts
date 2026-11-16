// Las 3 direcciones de diseño del Diseñador (refs/fichas-disenador-final.md). Colores medidos en las referencias;
// "muted" y "onAccent" son propuestas para cumplir contraste AA. Las tipografías: FONT_PACKS acá, cargadas en templates/fonts.ts.
export type DirectionId = "editorial" | "grotesk" | "photo" | "studio";

export type Tokens = { bg: string; ink: string; muted: string; accent: string; onAccent: string; line: string; card: string; radius: string };

export const DIRECTIONS: Record<DirectionId, { label: string; tokens: Tokens }> = {
  editorial: {
    label: "A. Editorial cálida",
    tokens: { bg: "#f3eee4", ink: "#463b29", muted: "#6b5d45", accent: "#4b1611", onAccent: "#f3eee4", line: "#ddd3c1", card: "#f7c59c", radius: "27px" },
  },
  grotesk: {
    label: "B. Grotesca gigante",
    tokens: { bg: "#fcfcfc", ink: "#080807", muted: "#545454", accent: "#526f9c", onAccent: "#ffffff", line: "#e2e2e2", card: "#f1f1f1", radius: "20px" },
  },
  photo: {
    label: "C. Fotografía con color",
    tokens: { bg: "#f6ead2", ink: "#202020", muted: "#4f4a42", accent: "#b74233", onAccent: "#ffffff", line: "#e3d5b9", card: "#ffffff", radius: "20px" },
  },
  // Estudios de arquitectura: sitio de 3 páginas (Inicio, Proyectos, Estudio). Sobria, ángulos rectos, fotos grandes.
  studio: {
    label: "D. Estudio (varias páginas)",
    tokens: { bg: "#f2f1ed", ink: "#141414", muted: "#5b5953", accent: "#1f3b33", onAccent: "#f2f1ed", line: "#d9d6cf", card: "#e7e4dd", radius: "0px" },
  },
};

/** Paletas alternativas dentro de una dirección (por tipo de negocio). Se guardan en brand.palette; el color de marca sigue mandando en el acento. */
export const PALETTES: Record<string, { label: string; direction: DirectionId; tokens: Tokens }> = {
  // Barberías: oscura con bronce (lo habitual del rubro), en vez del blanco de la B.
  barber: {
    label: "Barbería (oscura con bronce)",
    direction: "grotesk",
    // El "acento" es un negro apenas más claro y el bronce va encima: un bloque entero de bronce queda chillón.
    tokens: { bg: "#141413", ink: "#f1ede4", muted: "#a9a398", accent: "#24221f", onAccent: "#c9a46a", line: "#2e2d2a", card: "#1e1d1b", radius: "6px" },
  },
};

/** Tokens de la dirección, con la paleta alternativa si es de esa dirección. */
export function baseTokens(direction: DirectionId, palette?: string): Tokens {
  const p = palette ? PALETTES[palette] : undefined;
  return p && p.direction === direction ? p.tokens : DIRECTIONS[direction].tokens;
}

// Pack de tipografías gratuitas (Google Fonts) por dirección, de las alternativas de refs/fichas-disenador-final.md.
// La primera de cada dirección es la de la ficha. display = títulos, body = texto, label = etiquetas.
export type FontPack = { id: string; name: string; display: string; body: string; label: string };
export const FONT_PACKS: Record<DirectionId, FontPack[]> = {
  editorial: [
    { id: "fraunces", name: "Fraunces + DM Sans", display: "Fraunces", body: "DM Sans", label: "Anton" },
    { id: "instrument", name: "Instrument Serif + Manrope", display: "Instrument Serif", body: "Manrope", label: "Anton" },
  ],
  grotesk: [
    { id: "inter-tight", name: "Inter Tight", display: "Inter Tight", body: "Inter Tight", label: "Inter Tight" },
    { id: "dm-sans", name: "DM Sans", display: "DM Sans", body: "DM Sans", label: "DM Sans" },
  ],
  photo: [
    { id: "inter", name: "Inter + DM Mono", display: "Inter", body: "Inter", label: "DM Mono" },
    { id: "manrope", name: "Manrope + DM Mono", display: "Manrope", body: "Manrope", label: "DM Mono" },
  ],
  studio: [
    { id: "hanken", name: "Hanken Grotesk + IBM Plex Mono", display: "Hanken Grotesk", body: "Hanken Grotesk", label: "IBM Plex Mono" },
    { id: "newsreader", name: "Newsreader + Hanken Grotesk", display: "Newsreader", body: "Hanken Grotesk", label: "IBM Plex Mono" },
  ],
};

/** Pack de la demo: el elegido si es de esta dirección; si no, el que comparte una fuente con la web del negocio; si no, el de la ficha. */
export function fontPackFor(direction: DirectionId, chosen?: string, siteFamilies: string[] = []): FontPack {
  const packs = FONT_PACKS[direction];
  const used = new Set(siteFamilies.map((f) => f.toLowerCase()));
  return packs.find((p) => p.id === chosen) ?? packs.find((p) => [p.display, p.body].some((f) => used.has(f.toLowerCase()))) ?? packs[0];
}

// Por rubro. Estética va a B (no A) a pedido del usuario, para ver variantes distintas desde el principio.
const BY_NICHE: Record<string, DirectionId> = { dentist: "editorial", beauty: "grotesk", architecture: "studio", gym: "photo" };

export function directionFor(niche: string | null): DirectionId {
  return BY_NICHE[niche ?? ""] ?? "editorial";
}

/** Dirección de una demo guardada. Las demos viejas guardaban el rubro ("dentist", "beauty") en vez de la dirección. */
export function directionOf(template: string): DirectionId {
  return Object.hasOwn(DIRECTIONS, template) ? (template as DirectionId) : directionFor(template);
}

/** Contraste WCAG entre dos colores #rrggbb. */
export function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
