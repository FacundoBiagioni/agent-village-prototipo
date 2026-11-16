// Reglas de código para los mensajes de venta: el link lo pone el código, no el modelo.

export const LINK_MARK = "[LINK_DEMO]";
const FORBIDDEN = /https?:\/\/|www\.|\S+@\S+\.\S+|\d[\d\s-]{6,}\d|\$\s?\d|\bUSD\b|\bd[óo]lares?\b/i;

/** Problemas del texto del mensaje (vacío = válido). */
export function checkMessage(text: unknown): string[] {
  if (typeof text !== "string" || !text.trim()) return ["sin texto"];
  const p: string[] = [];
  if (text.length > 600) p.push("más de 600 caracteres");
  if (text.split(LINK_MARK).length !== 2) p.push(`tiene que incluir ${LINK_MARK} exactamente una vez`);
  const m = text.replace(LINK_MARK, "").match(FORBIDDEN);
  if (m) p.push(`texto prohibido: ${m[0]}`);
  if (/\b(tú|tienes|puedes|quieres|contáctame|te gustaría ver)\b/i.test(text)) p.push("no usa voseo");
  if ((text.match(/\p{Extended_Pictographic}/gu) ?? []).length > 1) p.push("demasiados emojis");
  // "Miránla", "fijánse": mezcla de voseo y "ustedes" que Claude repitió aunque la skill lo prohíbe (2026-11-02).
  const mixed = text.match(/[a-záéíóúñ]+án(la|lo|las|los|se|me|nos)(?![a-záéíóúñ])/i);
  if (mixed) p.push(`imperativo mal conjugado: "${mixed[0]}" (con ustedes: "mírenla", "fíjense")`);
  return p;
}

/** Celular argentino en formato de WhatsApp (549 + área + número), o null si no se puede escribir por WhatsApp. */
export function whatsappNumber(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.startsWith("549") && d.length >= 12 && d.length <= 13 ? d : null;
}

export function waUrl(number: string, text: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
