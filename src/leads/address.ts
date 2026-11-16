const CPA = /\b[A-Z]\d{4}([A-Z]{3})\b/g; // código postal argentino (B1900BHT)

/** Overture trae la dirección con el código postal y sus 3 letras sueltas repetidas ("Calle 21 1211 B1900BHT, BHT"): se sacan. */
export function cleanAddress(address: string | null): string | null {
  if (!address) return address;
  const suffixes = [...address.matchAll(CPA)].map((m) => m[1]);
  let s = address.replace(CPA, "");
  for (const suf of suffixes) s = s.replace(new RegExp(`\\b${suf}\\b`, "g"), "");
  const parts = s.split(",").map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  return [...new Set(parts)].join(", ") || null;
}
