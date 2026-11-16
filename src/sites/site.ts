// Sitio final de un cliente (Fase 7): la demo que eligió, sin el aviso de "propuesta", indexable y en la raíz de su dominio.
// Se sube a Vercel, en la cuenta del usuario (plan Pro: el gratis no permite uso comercial). Solo desde una acción aprobada.
import { execFile } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { DemoContent } from "@/demos/content";
import { galleryPages } from "@/demos/gallery-store";
import { exportDemos } from "@/demos/publish";
import { NOTICE_MARK } from "@/demos/opus";
import { readAuth, siteToken } from "@/lib/auth";

const run = promisify(execFile);
export const SITES_DIR = join(process.cwd(), "data", "sites");
const VERCEL_CLI = "vercel@65"; // verificado en npm el 2026-11-12 (65.15.0)

/** Nombre del proyecto en Vercel: el del negocio en minúsculas y con guiones, más 4 letras del slug para que no choque. */
export const projectName = (business: string, slug: string) =>
  `${business.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "sitio"}-${slug.slice(0, 4)}`;

/** HTML de demo → HTML del sitio: sin el aviso de propuesta, sin noindex y con las rutas en la raíz. */
export function finalizeHtml(html: string, slug: string, title?: string) {
  let out = html.replace(/<meta[^>]+name="robots"[^>]*>/gi, "");
  if (title) out = out.replace("<title>Propuesta de sitio web</title>", `<title>${title.replace(/[<&]/g, "")}</title>`);
  // El aviso: el elemento más chico que lo contiene (lo escriben las plantillas, la galería u Opus).
  const at = out.indexOf(NOTICE_MARK);
  if (at >= 0) {
    const open = [...out.slice(0, at).matchAll(/<([a-z][a-z0-9]*)\b[^>]*>/gi)].pop();
    if (open) {
      const close = out.indexOf(`</${open[1]}>`, at);
      if (close >= 0) out = out.slice(0, open.index) + out.slice(close + open[1].length + 3);
    }
  }
  // Contenedores que quedaron vacíos (la franja del aviso).
  for (let i = 0; i < 3; i++) out = out.replace(/<(div|p|section|header|aside|span)\b[^>]*>\s*<\/\1>/gi, "");
  const demo = `/demo/${slug}`;
  return out.replaceAll(`${demo}/`, "/").replaceAll(`"${demo}"`, '"/"').replaceAll(`'${demo}'`, "'/'");
}

const PAUSED_PAGE = (name: string) => `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${name.replace(/[<&"]/g, "")}</title>
<body style="margin:0;min-height:100dvh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#fafaf9;color:#1c1917;text-align:center;padding:16px">
<div><h1 style="font-size:1.5rem;margin:0 0 8px">Sitio en mantenimiento</h1><p style="margin:0;color:#57534e">Volvemos a estar en línea en breve.</p></div></body></html>`;

/** Arma la carpeta del sitio: exporta la demo (aunque haya vencido) y la pasa a la raíz. */
export async function buildSite(demo: { slug: string; content: unknown; expiresAt: Date }, project: string) {
  const secret = readAuth()?.secret;
  if (!secret) throw new Error("Falta la contraseña del panel (data/auth.json)");
  const c = demo.content as DemoContent;
  const ready: Record<string, string> = {};
  if (c.design === "opus" && c.opus) ready[`/demo/${demo.slug}`] = c.opus.html;
  const gallery = c.design === "galeria" ? await galleryPages(c, demo.expiresAt, `/demo/${demo.slug}`) : null;
  for (const [name, html] of Object.entries(gallery ?? {})) ready[name === "inicio" ? `/demo/${demo.slug}` : `/demo/${demo.slug}/${name}`] = html;
  const tmp = join(SITES_DIR, `.export-${project}`);
  await exportDemos([demo.slug], tmp, ready, { "x-av-site": siteToken(demo.slug, secret) });
  const out = join(SITES_DIR, project);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const src = join(tmp, "demo", demo.slug);
  let pages = 0;
  for (const rel of await readdir(src, { recursive: true })) {
    const file = String(rel);
    if (file.startsWith("media")) continue;
    if (!file.endsWith("index.html")) continue;
    const dest = join(out, file);
    await mkdir(join(dest, ".."), { recursive: true });
    await writeFile(dest, finalizeHtml(await readFile(join(src, file), "utf8"), demo.slug, c.business.name));
    pages++;
  }
  await cp(join(src, "media"), join(out, "media"), { recursive: true }).catch(() => {}); // sin fotos: no hay carpeta
  await cp(join(tmp, "_next"), join(out, "_next"), { recursive: true }).catch(() => {}); // tipografías
  await writeFile(join(out, "404.html"), PAUSED_PAGE(c.business.name).replace("Sitio en mantenimiento", "Página no encontrada").replace("Volvemos a estar en línea en breve.", '<a href="/">Volver al inicio</a>'));
  await rm(tmp, { recursive: true, force: true });
  return { dir: out, pages };
}

/** Carpeta con la página de "en mantenimiento" (cuota impaga): reemplaza al sitio sin borrar nada de lo guardado. */
export async function buildPausedSite(name: string, project: string) {
  const out = join(SITES_DIR, `${project}-pausa`, project); // la carpeta se llama como el proyecto: Vercel lo toma de ahí
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await writeFile(join(out, "index.html"), PAUSED_PAGE(name));
  await writeFile(join(out, "404.html"), PAUSED_PAGE(name));
  return { dir: out };
}

function vercelEnv() {
  // Igual que con Cloudflare: la herramienta de Vercel recibe solo lo del sistema y sus claves, nunca el resto del .env.
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(PATH|PATHEXT|SYSTEMROOT|SYSTEMDRIVE|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|PROGRAMDATA|PROGRAMFILES.*|NODE_EXTRA_CA_CERTS|VERCEL_TOKEN|npm_config_.+)$/i.test(k))) as NodeJS.ProcessEnv;
  if (!env.VERCEL_TOKEN) throw new Error("Falta VERCEL_TOKEN en .env: la subida a Vercel se habilita cuando tengas el plan Pro (el gratis no permite sitios de clientes)");
  return env;
}
const scope = () => (process.env.VERCEL_SCOPE ? ["--scope", process.env.VERCEL_SCOPE] : []);

/** Sube la carpeta a producción. La primera vez crea el proyecto con el nombre de la carpeta. shortcut: sin probar contra Vercel (falta el plan Pro); probar con el primer cliente. */
export async function deployToVercel(dir: string) {
  const env = vercelEnv();
  const { stdout } = await run("npx", ["--yes", VERCEL_CLI, "deploy", `"${dir}"`, "--prod", "--yes", ...scope()], { env, shell: true, maxBuffer: 10_000_000 });
  const url = stdout.match(/https:\/\/[^\s]+\.vercel\.app/)?.[0];
  return { url: url ?? null, log: stdout.slice(-500) };
}

/** Conecta el dominio del cliente (y el www) al proyecto. Vercel muestra después qué cargar en NIC Argentina. */
export async function addDomain(domain: string, project: string) {
  const env = vercelEnv();
  for (const d of [domain, `www.${domain}`]) {
    try {
      await run("npx", ["--yes", VERCEL_CLI, "domains", "add", d, project, ...scope()], { env, shell: true });
    } catch (err) {
      if (!/already|ya existe/i.test(String((err as { stderr?: string }).stderr ?? err))) throw err;
    }
  }
}

export const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})*\.(com\.ar|ar|com|net|org)$/;
