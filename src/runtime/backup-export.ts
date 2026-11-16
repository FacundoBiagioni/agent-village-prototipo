// Copia de seguridad para el pendrive (usuario, 2026-11-07): un .zip con la base completa y las fotos de las demos.
// "nuevo": la base completa (pesa poco) y solo las fotos agregadas o cambiadas desde el último punto de guardado.
// No lleva .env, data/auth.json ni certificados: las claves no viajan en un pendrive.
import { execFile } from "node:child_process";
import { cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { dumpDatabase } from "./db-dump";

const run = promisify(execFile);
const MEDIA = join(process.cwd(), "data", "demo-media");
const WORK = join(process.cwd(), "data", "respaldo-tmp");
// El tar de Windows (bsdtar) arma .zip; el de Git Bash no entiende rutas C:\.
const TAR = process.env.SystemRoot ? join(process.env.SystemRoot, "System32", "tar.exe") : "tar";
const KEY = "backup_checkpoint";

export type Checkpoint = { at: string; mode: "todo" | "nuevo"; photos: number; bytes: number };

export async function getCheckpoint(): Promise<Checkpoint | null> {
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, KEY));
  return (row?.value as Checkpoint) ?? null;
}

/** Fotos de las demos (ruta relativa a demo-media) modificadas después de `since` (todas si es null). */
export async function mediaSince(since: Date | null, dir = MEDIA) {
  const out: string[] = [];
  for (const slug of await readdir(dir).catch(() => [] as string[])) {
    for (const file of await readdir(join(dir, slug)).catch(() => [] as string[])) {
      const p = join(dir, slug, file);
      const s = await stat(p).catch(() => null);
      if (s?.isFile() && (!since || s.mtime > since)) out.push(relative(dir, p));
    }
  }
  return out;
}

/** Cuánto pesa hoy lo que iría en la copia (para mostrarlo antes de descargar). */
export async function backupPreview() {
  const last = await getCheckpoint();
  const [all, fresh, [size]] = await Promise.all([
    mediaSince(null),
    last ? mediaSince(new Date(last.at)) : Promise.resolve(null),
    db.execute(sql`select pg_database_size(current_database())::bigint as bytes`).then((r) => r.rows as { bytes: string }[]),
  ]);
  return { checkpoint: last, photosAll: all.length, photosNew: fresh?.length ?? all.length, dbBytes: Number(size.bytes) };
}

const readme = (mode: "todo" | "nuevo", since: Date | null, photos: number, now: Date) => `AGENT VILLAGE · COPIA DE SEGURIDAD
Hecha el ${now.toLocaleString("es-AR")} · tipo: ${mode === "todo" ? "TODO" : `SOLO LO NUEVO desde el ${since!.toLocaleString("es-AR")}`}

Qué tiene:
- base-de-datos.dump: la base COMPLETA (negocios, demos, mensajes, ventas, visitas, plantillas, registros de los agentes).
- demo-media/: ${photos} foto(s) de las demos${mode === "nuevo" ? " agregadas o cambiadas desde la copia anterior" : ""}.

Qué NO tiene (a propósito): el archivo .env (claves de Telegram, Instagram, Cloudflare), tu contraseña del panel y los certificados del celular.
Guardá el .env aparte si querés poder rehacer todo en otra PC. El código está en GitHub.

Para restaurar (pedíselo a Claude Code, o a mano):
1. La base: usá la copia MÁS RECIENTE (cualquiera de los dos tipos trae la base completa):
   pg_restore --clean --if-exists -d agent_village base-de-datos.dump
2. Las fotos: copiá en data/demo-media la carpeta demo-media de la última copia "TODO" y después, en orden, la de cada copia "SOLO LO NUEVO" posterior.
`;

/** Arma el .zip y deja este momento como nuevo punto de guardado. Devuelve la ruta del archivo (se borra después de enviarlo). */
export async function createBackup(mode: "todo" | "nuevo") {
  const now = new Date();
  const last = await getCheckpoint();
  const since = mode === "nuevo" && last ? new Date(last.at) : null;
  // Hora de Argentina (UTC-3, sin horario de verano) en el nombre del archivo.
  const stamp = new Date(now.getTime() - 3 * 3_600_000).toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const dir = join(WORK, stamp);
  const content = join(dir, "contenido");
  await rm(dir, { recursive: true, force: true });
  await mkdir(join(content, "demo-media"), { recursive: true });

  await dumpDatabase(join(content, "base-de-datos.dump"));
  const photos = await mediaSince(since);
  for (const p of photos) await cp(join(MEDIA, p), join(content, "demo-media", p));
  await writeFile(join(content, "LEEME.txt"), readme(since ? "nuevo" : "todo", since, photos.length, now));

  const zip = join(dir, `agent-village-${since ? "nuevo" : "todo"}-${stamp}.zip`);
  // Nombres sin "./" adelante: con "." el Explorador de Windows abre el .zip y lo ve vacío (pasó el 2026-11-07).
  await run(TAR, ["-a", "-c", "-f", zip, "-C", content, "base-de-datos.dump", "LEEME.txt", "demo-media"]);
  const bytes = (await stat(zip)).size;
  const next: Checkpoint = { at: now.toISOString(), mode: since ? "nuevo" : "todo", photos: photos.length, bytes };
  await db.insert(schema.settings).values({ key: KEY, value: next }).onConflictDoUpdate({ target: schema.settings.key, set: { value: next } });
  return { zip, dir, bytes, photos: photos.length, mode: next.mode };
}
