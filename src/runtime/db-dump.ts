import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Volcado completo de la base (pg_dump, formato propio de PostgreSQL). Lo usan el respaldo diario y la copia para el pendrive. */
export async function dumpDatabase(file: string) {
  const bin = process.env.PG_BIN ?? "C:\\Program Files\\PostgreSQL\\18\\bin";
  const url = new URL(process.env.DATABASE_URL!);
  // La contraseña va por variable de entorno, no en la línea de comandos.
  await run(join(bin, "pg_dump.exe"), ["-h", url.hostname, "-p", url.port || "5432", "-U", url.username, "-Fc", "-f", file, url.pathname.slice(1)], {
    env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) },
  });
}
