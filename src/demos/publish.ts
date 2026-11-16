import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
export const PAGES_PROJECT = process.env.CLOUDFLARE_PAGES_PROJECT ?? "agent-village-demos";
const LOCAL = process.env.APP_URL ?? "http://127.0.0.1:3000";

const GONE_PAGE = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Propuesta no disponible</title>
<body style="margin:0;min-height:100dvh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#fafaf9;color:#1c1917;text-align:center;padding:16px">
<div><h1 style="font-size:1.5rem;margin:0 0 8px">Esta propuesta ya no está disponible</h1><p style="margin:0;color:#57534e">La muestra de sitio web que estás buscando venció o fue retirada.</p></div></body></html>`;

/** Saca el JavaScript: la demo publicada es solo HTML y CSS (más liviana y sin código que ejecutar). */
export function staticHtml(html: string) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<link[^>]+as="script"[^>]*>/gi, "")
    // React manda el contenido escondido (<div hidden id="S:n">) y lo muestra con JavaScript: sin JS hay que destaparlo.
    .replace(/<div hidden id="(S:\d+)">/g, '<div id="$1">');
}

/** Las url(...) relativas de un CSS pasan a rutas absolutas del sitio; devuelve el CSS y los archivos que pide. */
export function absolutizeCss(css: string, cssPath: string) {
  const files: string[] = [];
  const out = css.replace(/url\((["']?)([^"')]+)\1\)/g, (m, q, ref: string) => {
    if (/^(data:|https?:|#)/.test(ref)) return m;
    const abs = new URL(ref, `http://x${cssPath}`).pathname;
    files.push(abs);
    return `url(${q}${abs}${q})`;
  });
  return { css: out, files };
}

/** Arma la carpeta estática con las demos indicadas, renderizadas por la app local. El CSS va dentro de cada página.
 *  `pages`: páginas que ya son HTML completo (versión de Opus o plantilla de la galería), por ruta ("/demo/slug", "/demo/slug/servicios"). */
export async function exportDemos(slugs: string[], outDir: string, pages: Record<string, string> = {}, headers: Record<string, string> = {}) {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const assets = new Set<string>();
  // Cada demo, y sus páginas extra: las ya armadas, o las que enlaza (dirección de varias páginas: /demo/slug/proyectos).
  const own = (slug: string) => Object.keys(pages).filter((p) => p === `/demo/${slug}` || p.startsWith(`/demo/${slug}/`));
  const queue: { slug: string; path: string }[] = slugs.flatMap((slug) => (own(slug).length ? own(slug) : [`/demo/${slug}`]).map((path) => ({ slug, path })));
  const seen = new Set(queue.map((q) => q.path));
  for (const { slug, path } of queue) {
    let html: string;
    if (pages[path]) html = pages[path];
    else {
      const r = await fetch(`${LOCAL}${path}`, { headers });
      if (!r.ok) throw new Error(`No se pudo renderizar ${path}: HTTP ${r.status}`);
      html = staticHtml(await r.text());
      for (const m of html.matchAll(new RegExp(`href="(/demo/${slug}/[a-z]+)"`, "g"))) {
        if (!m[1].endsWith("/media") && !seen.has(m[1])) {
          seen.add(m[1]);
          queue.push({ slug, path: m[1] });
        }
      }
    }
    for (const [tag, href] of [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)].map((m) => [m[0], m[1]])) {
      const res = await fetch(new URL(href, LOCAL));
      if (!res.ok) throw new Error(`Falta la hoja de estilo ${href}: HTTP ${res.status}`);
      const { css, files } = absolutizeCss(await res.text(), new URL(href, LOCAL).pathname);
      files.forEach((f) => assets.add(f));
      html = html.replace(tag, `<style>${css}</style>`);
    }
    html = html.replace(/<link[^>]+rel="preload"[^>]*>/gi, ""); // precargas de archivos que ya no se usan
    for (const p of html.matchAll(new RegExp(`/demo/${slug}/media/[0-9a-f]{16}\\.webp`, "g"))) assets.add(p[0]); // fotos de la demo
    await mkdir(join(outDir, path), { recursive: true });
    await writeFile(join(outDir, path, "index.html"), html);
  }
  for (const p of assets) {
    if (!/^\/_next\/static\/media\/[\w.-]+$|^\/demo\/[a-z0-9]{10}\/media\/[0-9a-f]{16}\.webp$/.test(p)) throw new Error(`Archivo inesperado en el CSS: ${p}`);
    const r = await fetch(`${LOCAL}${p}`);
    if (!r.ok) throw new Error(`Falta el archivo ${p}: HTTP ${r.status}`);
    await mkdir(join(outDir, dirname(p)), { recursive: true });
    await writeFile(join(outDir, p), Buffer.from(await r.arrayBuffer()));
  }
  // Ninguna demo se indexa (PLAN 11), y la raíz no muestra nada.
  await writeFile(join(outDir, "_headers"), "/*\n  X-Robots-Tag: noindex, nofollow\n");
  await writeFile(join(outDir, "index.html"), '<!doctype html><meta name="robots" content="noindex"><title>Propuestas</title>');
  // Demo vencida o sacada: Cloudflare sirve 404.html (si no existe, devuelve la raíz en blanco).
  await writeFile(join(outDir, "404.html"), GONE_PAGE);
  return { demos: slugs.length, pages: queue.length, files: assets.size };
}

/** Sube la carpeta a Cloudflare Pages con wrangler (crea el proyecto la primera vez). Solo se llama desde una acción aprobada. */
export async function deployToPages(outDir: string) {
  // wrangler@4 se baja con npx (última 4.x): recibe solo lo del sistema y Cloudflare, nunca las demás claves del .env.
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(PATH|PATHEXT|SYSTEMROOT|SYSTEMDRIVE|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|PROGRAMDATA|PROGRAMFILES.*|NODE_EXTRA_CA_CERTS|CLOUDFLARE_.+|npm_config_.+)$/i.test(k))) as NodeJS.ProcessEnv;
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) throw new Error("Faltan CLOUDFLARE_API_TOKEN o CLOUDFLARE_ACCOUNT_ID en .env");
  const wrangler = ["--yes", "wrangler@4"];
  try {
    await run("npx", [...wrangler, "pages", "project", "create", PAGES_PROJECT, "--production-branch", "main"], { env, shell: true });
  } catch (err) {
    if (!/already exists|already been taken|8000002/i.test(String((err as { stderr?: string }).stderr ?? err))) throw err;
  }
  const { stdout } = await run("npx", [...wrangler, "pages", "deploy", `"${outDir}"`, "--project-name", PAGES_PROJECT, "--branch", "main", "--commit-dirty=true"], { env, shell: true, maxBuffer: 10_000_000 });
  const url = stdout.match(/https:\/\/[^\s]+\.pages\.dev/)?.[0];
  // Cloudflare deja cada subida vieja en su propia dirección (abc123.proyecto.pages.dev): se borran para que una demo vencida no quede en internet.
  const removed = url ? await deleteOldDeployments(new URL(url).hostname.split(".")[0], env) : 0;
  return { url: url ?? `https://${PAGES_PROJECT}.pages.dev`, removedDeployments: removed, log: stdout.slice(-500) };
}

async function deleteOldDeployments(currentPrefix: string, env: NodeJS.ProcessEnv) {
  const { stdout } = await run("npx", ["--yes", "wrangler@4", "pages", "deployment", "list", "--project-name", PAGES_PROJECT, "--json"], { env, shell: true, maxBuffer: 10_000_000 });
  const old = (JSON.parse(stdout.slice(stdout.indexOf("["))) as { Id: string }[]).filter((d) => /^[0-9a-f-]{36}$/.test(d.Id) && !d.Id.startsWith(currentPrefix));
  for (const d of old) await run("npx", ["--yes", "wrangler@4", "pages", "deployment", "delete", d.Id, "--project-name", PAGES_PROJECT, "--force"], { env, shell: true });
  return old.length;
}
