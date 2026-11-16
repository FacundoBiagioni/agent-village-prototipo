// Inicio de sesión de un solo usuario (Fase 3, antes de abrir la app al celular).
// La contraseña (scrypt) y el secreto de la sesión viven en data/auth.json (fuera de git), no en el código ni en .env.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const SESSION_COOKIE = "av_session";
export const SESSION_DAYS = 30;
const FILE = join(process.cwd(), "data", "auth.json");

type AuthFile = { salt: string; hash: string; secret: string };
let cached: AuthFile | undefined;

// Solo se guarda en memoria cuando existe: el proxy corre en otro módulo y tiene que ver la contraseña recién creada.
export function readAuth(): AuthFile | null {
  if (cached) return cached;
  try {
    cached = JSON.parse(readFileSync(FILE, "utf8")) as AuthFile;
    return cached;
  } catch {
    return null; // todavía no hay contraseña
  }
}

const hashOf = (password: string, salt: string) => scryptSync(password, salt, 64).toString("hex");
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export const MIN_PASSWORD = 10;

/** Crea la contraseña la primera vez. Si ya existe, no la pisa. */
export function setupPassword(password: string) {
  if (readAuth()) throw new Error("La contraseña ya está creada");
  if (password.length < MIN_PASSWORD) throw new Error(`La contraseña tiene que tener al menos ${MIN_PASSWORD} caracteres`);
  const salt = randomBytes(16).toString("hex");
  const auth = { salt, hash: hashOf(password, salt), secret: randomBytes(32).toString("hex") };
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(auth), { flag: "wx" }); // wx: falla si otro la creó al mismo tiempo
  cached = auth;
}

export function checkPassword(password: string, auth = readAuth()) {
  return !!auth && same(hashOf(password, auth.salt), auth.hash);
}

/** Firma interna para exportar el sitio final de un cliente aunque su demo haya vencido (la usa solo el worker, contra la app local). */
export const siteToken = (slug: string, secret: string) => createHmac("sha256", secret).update(`site:${slug}`).digest("hex");
export const verifySiteToken = (slug: string, token: string | null, secret = readAuth()?.secret) => !!token && !!secret && same(token, siteToken(slug, secret));

/** Valor de la cookie: vencimiento + firma. */
export function signSession(secret: string, now = Date.now()) {
  const exp = String(now + SESSION_DAYS * 86_400_000);
  return `${exp}.${createHmac("sha256", secret).update(exp).digest("hex")}`;
}

export function verifySession(token: string | undefined, secret: string | undefined, now = Date.now()) {
  if (!token || !secret) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < now) return false;
  return same(sig, createHmac("sha256", secret).update(exp).digest("hex"));
}
