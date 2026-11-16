// Revisión de una skill de terceros antes de instalarla (PLAN 8, seguridad): reglas puras.
// El texto de la skill es dato de terceros hasta que el usuario la aprueba: acá solo se analiza.

/** Licencias abiertas que permiten copiar la skill a nuestro proyecto. */
const OPEN = /^(apache-2\.0|apache license 2\.0|mit|bsd-[23]-clause|isc|cc0-1\.0|unlicense)$/i;

export function frontmatter(md: string): Record<string, string> {
  const m = md.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out: Record<string, string> = {};
  let key: string | null = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (kv) {
      key = kv[1].toLowerCase();
      // "description: >" o "|": el texto sigue en las líneas de abajo, con sangría.
      out[key] = /^[>|][-+]?$/.test(kv[2].trim()) ? "" : kv[2].trim().replace(/^["']|["']$/g, "");
    } else if (key && /^\s+\S/.test(line)) out[key] = `${out[key]} ${line.trim()}`.trim();
  }
  return out;
}

/** Licencia de la skill: la del encabezado o la del archivo LICENSE. "desconocida" si no hay. */
export function detectLicense(md: string, licenseFile: string | null) {
  const fm = frontmatter(md).license;
  if (fm && /proprietary|propietari|all rights reserved/i.test(fm)) return "propietaria";
  // "Complete terms in LICENSE.txt" (así lo hacen las skills oficiales de Anthropic): manda el archivo.
  if (fm && !/license\.(txt|md)|license file/i.test(fm)) return /apache/i.test(fm) && /2/.test(fm) ? "Apache-2.0" : /\bmit\b/i.test(fm) ? "MIT" : fm;
  if (licenseFile) {
    if (/Apache License\s+Version 2\.0/i.test(licenseFile)) return "Apache-2.0";
    if (/\bMIT License\b|Permission is hereby granted, free of charge/i.test(licenseFile)) return "MIT";
    if (/all rights reserved|proprietary|source[- ]available/i.test(licenseFile)) return "propietaria";
  }
  return "desconocida";
}

export const licenseAllowed = (license: string) => OPEN.test(license.trim());

const SCRIPT = /\.(py|js|mjs|cjs|ts|sh|bash|ps1|bat|cmd|exe|rb|pl|php)$/i;
// Frases que suelen aparecer en skills maliciosas: órdenes de ignorar reglas, sacar claves o mandar datos afuera.
const SUSPICIOUS = [
  [/ignore (all |any )?(previous|prior|above) (instructions|rules)/i, "pide ignorar instrucciones anteriores"],
  [/(api[_ -]?key|password|contraseña|secret|token|credential)s?\b[^.\n]{0,60}\b(send|post|upload|enviar|mand)/i, "habla de mandar claves o contraseñas"],
  [/\b(curl|wget|invoke-webrequest|fetch\()\b/i, "trae comandos para descargar o enviar datos"],
  [/\b(rm -rf|del \/f|format c:|drop table)\b/i, "trae comandos destructivos"],
  [/\.env\b|process\.env|os\.environ/i, "menciona variables de entorno o el archivo .env"],
] as const;

export type Review = { files: number; scripts: string[]; urls: string[]; warnings: string[]; tokens: number; license: string; allowed: boolean };

/** Analiza la skill: licencia, programas incluidos, links y frases sospechosas. */
export function reviewSkill(o: { md: string; files: string[]; licenseFile: string | null }): Review {
  const scripts = o.files.filter((f) => SCRIPT.test(f));
  const urls = [...new Set(o.md.match(/https?:\/\/[^\s)>"'\]]+/g) ?? [])];
  const warnings: string[] = [];
  for (const [re, why] of SUSPICIOUS) if (re.test(o.md)) warnings.push(why);
  if (scripts.length) warnings.push(`trae ${scripts.length} programa(s) que NO se instalan; si la skill depende de ellos, puede quedar incompleta`);
  if (/\bscripts?\//i.test(o.md) && !scripts.length) warnings.push("menciona una carpeta de scripts");
  if (urls.length) warnings.push(`tiene ${urls.length} link(s) a sitios externos`);
  const license = detectLicense(o.md, o.licenseFile);
  return { files: o.files.length, scripts, urls, warnings, tokens: Math.ceil(o.md.replace(/^---[\s\S]*?---\s*/, "").length / 4), license, allowed: licenseAllowed(license) };
}

/** Nombre de carpeta seguro (el de la skill se usa como carpeta en .claude/skills/). */
export const safeSkillName = (name: string) => /^[a-z0-9][a-z0-9-]{1,63}$/.test(name);

const MAX_SKILLS = 60; // por fuente: un repositorio enorme no llena la tienda ni tarda minutos

/** "https://github.com/dueño/repo/tree/main/x", "github.com/dueño/repo.git" o "dueño/repo" → "dueño/repo". null si no es de GitHub. */
export function parseGithubRepo(input: string): string | null {
  const s = input.trim().replace(/^https?:\/\//i, "").replace(/^(www\.)?github\.com\//i, "");
  if (/^[a-z0-9.-]+\.[a-z]{2,}\//i.test(s)) return null; // otro sitio
  const m = s.match(/^([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100}?)(\.git)?(\/.*)?$/);
  return m && m[2] !== "." && m[2] !== ".." ? `${m[1]}/${m[2]}` : null;
}

/** Carpetas con SKILL.md en la lista de archivos del repo. Si una skill aparece dos veces (copias), queda la de ruta más corta. */
export function skillsFromTree(paths: string[]) {
  const dirs = paths.filter((p) => p === "SKILL.md" || p.endsWith("/SKILL.md")).map((p) => p.slice(0, -"SKILL.md".length).replace(/\/$/, ""));
  const byName = new Map<string, string>();
  for (const dir of dirs.sort((a, b) => a.length - b.length)) {
    const name = (dir.split("/").pop() || "").toLowerCase();
    if (safeSkillName(name) && !byName.has(name)) byName.set(name, dir);
  }
  return [...byName].slice(0, MAX_SKILLS).map(([name, dir]) => ({ name, dir, files: paths.filter((p) => p.startsWith(`${dir}/`)).map((p) => p.slice(dir.length + 1)) }));
}
