// Tienda de skills (PLAN 8): catálogo de repositorios de GitHub, revisión e instalación aprobada.
// Fuentes: el oficial de Anthropic y los que el usuario agrega pegando el link (settings.skill_sources).
// Verificado 2026-11-05 (docs.github.com): sin cuenta, 60 pedidos por hora a la API, sin costo. Cada fuente usa 2 pedidos
// (último commit + lista de archivos) y se guarda 24 h; los textos se bajan de raw.githubusercontent.com, fijados al commit.
// Nada se instala solo: el Encargado revisa y el usuario aprueba en la bandeja. Solo se copia el SKILL.md (nunca programas).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { detectLicense, frontmatter, licenseAllowed, parseGithubRepo, safeSkillName, skillsFromTree } from "./skill-review";

export const OFFICIAL = "anthropics/skills";
const DIR = join(process.cwd(), ".claude", "skills");
const DAY = 86_400_000;
const HEADERS = { "User-Agent": "agent-village", Accept: "application/vnd.github+json" };

export type CatalogItem = { name: string; description: string; files: string[]; license: string; allowed: boolean; repo: string; commit: string; path: string; licensePath?: string };
export type Source = { repo: string; at: number; commit: string; error?: string; items: CatalogItem[] };
export type Catalog = { at: number; sources: Source[]; items: CatalogItem[] };

async function get(url: string, json = true) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20_000) });
  if (res.status === 403 || res.status === 429) throw new Error("GitHub limita los pedidos sin cuenta (60 por hora): probá en un rato");
  if (res.status === 404) throw new Error("GitHub no encuentra ese repositorio (¿es privado o el link está mal?)");
  if (!res.ok) throw new Error(`GitHub respondió ${res.status} para ${url}`);
  return json ? res.json() : res.text();
}

const raw = (repo: string, commit: string, path: string) => `https://raw.githubusercontent.com/${repo}/${commit}/${path}`;

async function readSource(repo: string): Promise<Source> {
  const commit = ((await get(`https://api.github.com/repos/${repo}/commits/HEAD`)) as { sha: string }).sha;
  const tree = (await get(`https://api.github.com/repos/${repo}/git/trees/${commit}?recursive=1`)) as { tree: { path: string; type: string }[] };
  const paths = tree.tree.filter((f) => f.type === "blob").map((f) => f.path);
  // Licencia del repositorio: vale para las skills que no traen la suya.
  const rootLic = paths.find((p) => /^(LICENSE|LICENCE|COPYING)(\.(md|txt))?$/i.test(p));
  const repoLicense = rootLic ? ((await get(raw(repo, commit, rootLic), false)) as string) : null;
  const items: CatalogItem[] = [];
  for (const s of skillsFromTree(paths)) {
    const md = (await get(raw(repo, commit, `${s.dir}/SKILL.md`), false)) as string;
    const own = s.files.find((f) => /^LICEN[CS]E(\.(md|txt))?$/i.test(f));
    const licensePath = own ? `${s.dir}/${own}` : rootLic;
    const lic = own ? ((await get(raw(repo, commit, `${s.dir}/${own}`), false)) as string) : repoLicense;
    const license = detectLicense(md, lic);
    items.push({ name: s.name, description: frontmatter(md).description ?? "", files: s.files, license, allowed: licenseAllowed(license), repo, commit, path: s.dir, licensePath });
  }
  return { repo, at: Date.now(), commit, items: items.sort((a, b) => a.name.localeCompare(b.name)) };
}

async function load<T>(key: string): Promise<T | undefined> {
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, key));
  return row?.value as T | undefined;
}
async function save(key: string, value: unknown) {
  await db.insert(schema.settings).values({ key, value }).onConflictDoUpdate({ target: schema.settings.key, set: { value } });
}

export const getSources = async () => (await load<string[]>("skill_sources")) ?? [OFFICIAL];

/** Catálogo guardado (24 h por fuente) o leído de nuevo. `force`: true = todas, o el nombre de una fuente. */
export async function getCatalog(force: boolean | string = false): Promise<Catalog> {
  const cached = await load<Partial<Catalog>>("skill_catalog");
  const old = new Map((cached?.sources ?? []).map((s) => [s.repo, s])); // un catálogo del formato viejo (sin fuentes) se vuelve a leer
  let changed = false;
  const sources: Source[] = [];
  for (const repo of await getSources()) {
    const prev = old.get(repo);
    if (prev && force !== true && force !== repo && Date.now() - prev.at < DAY) {
      sources.push(prev);
      continue;
    }
    changed = true;
    // Una fuente que falla no tira abajo la tienda: se muestra el error y se conserva lo último leído.
    sources.push(await readSource(repo).catch((e: Error) => ({ ...(prev ?? { repo, commit: "", items: [] }), at: Date.now(), error: e.message })));
  }
  if (changed || sources.length !== old.size) await save("skill_catalog", { at: Date.now(), sources });
  return { at: Math.min(...sources.map((s) => s.at)), sources, items: sources.flatMap((s) => s.items) };
}

/** Agrega una fuente desde un link de GitHub y la lee en el momento. Devuelve cuántas skills encontró. */
export async function addSource(link: string) {
  const repo = parseGithubRepo(link);
  if (!repo) throw new Error("Pegá un link de GitHub, por ejemplo https://github.com/dueño/repositorio");
  const sources = await getSources();
  if (sources.some((s) => s.toLowerCase() === repo.toLowerCase())) throw new Error("Esa fuente ya está en la tienda");
  const src = await readSource(repo); // si no existe o no tiene skills, no se agrega
  if (!src.items.length) throw new Error(`${repo} no tiene ninguna carpeta con SKILL.md`);
  await save("skill_sources", [...sources, repo]);
  const cached = (await load<Partial<Catalog>>("skill_catalog"))?.sources ?? [];
  await save("skill_catalog", { at: Date.now(), sources: [...cached.filter((s) => s.repo !== repo), src] });
  return src.items.length;
}

/** Saca una fuente de la tienda. Lo ya instalado desde ahí queda instalado. */
export async function removeSource(repo: string) {
  await save("skill_sources", (await getSources()).filter((s) => s !== repo));
}

/** Baja la skill tal como está en el commit del catálogo (lo que se revisa es exactamente lo que se instala). */
export async function downloadSkill(name: string, repo = OFFICIAL) {
  const item = (await getCatalog()).items.find((i) => i.name === name && i.repo === repo);
  if (!item) throw new Error(`La skill "${name}" no está en el catálogo de ${repo}`);
  const md = (await get(raw(repo, item.commit, `${item.path}/SKILL.md`), false)) as string;
  // La de la skill o, si no trae, la del repositorio (la misma que usó el catálogo).
  const licenseFile = item.licensePath ? ((await get(raw(repo, item.commit, item.licensePath), false)) as string) : null;
  return { item, md, licenseFile, commit: item.commit, url: `https://github.com/${repo}/tree/${item.commit}/${item.path}` };
}

/** ¿Ya está en el inventario? Las propias del proyecto no tienen SOURCE.md: esas nunca se pisan. */
export async function installedFrom(name: string): Promise<"own" | "store" | null> {
  const md = await readFile(join(DIR, name, "SKILL.md"), "utf8").catch(() => null);
  if (md == null) return null;
  return (await readFile(join(DIR, name, "SOURCE.md"), "utf8").catch(() => null)) ? "store" : "own";
}

/** Instala lo aprobado: solo el SKILL.md revisado, más una nota de origen (SOURCE.md). */
export async function installSkill(p: { name: string; md: string; url: string; commit: string; license: string }) {
  if (!safeSkillName(p.name)) throw new Error("Nombre de skill inválido");
  if (!licenseAllowed(p.license)) throw new Error(`Licencia no permitida: ${p.license}`);
  if ((await installedFrom(p.name)) === "own") throw new Error("Ya existe una skill propia con ese nombre: no se pisa");
  const dir = join(DIR, p.name);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "SKILL.md"), p.md);
  await writeFile(join(dir, "SOURCE.md"), `Origen: ${p.url}\nCommit: ${p.commit}\nLicencia: ${p.license}\nInstalada: ${new Date().toISOString()} (aprobada por el usuario en la bandeja)\nSolo se copió el SKILL.md; los programas de la skill, si tenía, no se instalaron.\n`);
  return { instalada: p.name, carpeta: `.claude/skills/${p.name}` };
}
