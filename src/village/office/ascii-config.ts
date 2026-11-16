// Opciones del modo ASCII (sin three: también las usan el servidor y el HUD).

export type AsciiConfig = { on: boolean; charset: string; cell: number; tint: string; edges: boolean; invert: boolean };
export const ASCII_DEFAULT: AsciiConfig = { on: false, charset: "clasico", cell: 7, tint: "blanco", edges: true, invert: false };

export const ASCII_CHARSETS: { id: string; name: string; chars: string }[] = [
  { id: "clasico", name: "Clásico", chars: " .:-=+*#%@" },
  { id: "fino", name: "Fino (más tonos)", chars: " .'`^,:;Il!i~+_-?][}{1)(|tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@" },
  { id: "bloques", name: "Bloques", chars: " ░▒▓█" },
  { id: "puntos", name: "Puntos", chars: " .·•o●" },
  { id: "tecnico", name: "Técnico", chars: " .,:;+=xX$&#" },
  { id: "binario", name: "Binario", chars: " 01" },
  { id: "gatuno", name: "Gatuno", chars: " .,~^=owOW@" },
];
export const ASCII_TINTS: { id: string; name: string; fg: string; bg: string }[] = [
  { id: "blanco", name: "Blanco y negro", fg: "#f2f2f2", bg: "#000000" },
  { id: "ambar", name: "Ámbar", fg: "#ffb000", bg: "#0a0600" },
  { id: "verde", name: "Fósforo verde", fg: "#58f08a", bg: "#010a04" },
  { id: "papel", name: "Papel", fg: "#f4efe2", bg: "#17130f" },
  { id: "color", name: "Con color", fg: "#ffffff", bg: "#000000" },
];
export const ASCII_CELLS = [6, 7, 9, 11, 14];

/** Deja solo valores válidos (lo que llega del navegador o de la base no se da por bueno). */
export function cleanAscii(v: Partial<AsciiConfig> | undefined): AsciiConfig {
  const d = ASCII_DEFAULT;
  return {
    on: typeof v?.on === "boolean" ? v.on : d.on,
    charset: ASCII_CHARSETS.some((c) => c.id === v?.charset) ? v!.charset! : d.charset,
    cell: ASCII_CELLS.includes(v?.cell as number) ? v!.cell! : d.cell,
    tint: ASCII_TINTS.some((t) => t.id === v?.tint) ? v!.tint! : d.tint,
    edges: typeof v?.edges === "boolean" ? v.edges : d.edges,
    invert: typeof v?.invert === "boolean" ? v.invert : d.invert,
  };
}
