// Revisión de webs existentes (PLAN 6.1): código común, sin IA. Puntaje 0 = moderna, 100 = muy anticuada.

export type WebSignals = {
  https: boolean;
  mobile: boolean; // tiene <meta name="viewport">
  copyrightYear: number | null;
  generator: string | null;
  oldTech: string[]; // Flash, jQuery 1.x, maquetado con tablas, etc.
  parked: boolean; // dominio en venta o sin sitio
};

const PARKED = /(domain|dominio) (is )?(for sale|en venta)|this domain (has expired|is parked)|parked (free|domain)|buy this domain|sitio en construcci[oó]n|under construction/i;

export function analyzeHtml(html: string, finalUrl: string, now = new Date()): { signals: WebSignals; score: number } {
  const oldTech: string[] = [];
  if (/\.swf\b|application\/x-shockwave-flash/i.test(html)) oldTech.push("Flash");
  const jq = html.match(/jquery[.-]?(\d)\.\d+(?:\.\d+)?(?:\.min)?\.js/i);
  if (jq && Number(jq[1]) < 3) oldTech.push(`jQuery ${jq[1]}.x`);
  if ((html.match(/<table/gi) ?? []).length >= 3 && !/<(main|section|article|nav)\b/i.test(html)) oldTech.push("Maquetado con tablas");
  if (/<(font|center|marquee)\b/i.test(html)) oldTech.push("HTML antiguo");

  // Web en un subdominio de un constructor gratuito: tiene web, pero de aficionado (2026-11-10).
  const builder = freeBuilder(finalUrl);
  if (builder) oldTech.push(`Constructor gratuito (${builder})`);

  const gen = html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)/i)?.[1] ?? null;
  const wp = gen?.match(/WordPress (\d+)\./i);
  if (wp && Number(wp[1]) < 6) oldTech.push(`WordPress ${wp[1]}`);
  if (gen && /joomla! ?1\.|frontpage|dreamweaver/i.test(gen)) oldTech.push(gen);

  const years = [...html.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?((?:19|20)\d{2})/gi)].map((m) => Number(m[1]));
  const copyrightYear = years.length ? Math.max(...years) : null;

  const signals: WebSignals = {
    https: finalUrl.startsWith("https://"),
    mobile: /<meta[^>]+name=["']viewport["']/i.test(html),
    copyrightYear,
    generator: gen,
    oldTech,
    parked: PARKED.test(html), // no por "poco texto": las páginas hechas con JavaScript traen el HTML casi vacío
  };

  let score = 0;
  if (!signals.https) score += 25;
  if (!signals.mobile) score += 35;
  if (copyrightYear && now.getFullYear() - copyrightYear >= 4) score += 20;
  score += Math.min(30, oldTech.length * 15);
  if (builder) score = Math.max(score, 40); // un constructor gratuito alcanza para "anticuada", aunque sea https y para celular
  if (signals.parked) score = 100;
  return { signals, score: Math.min(100, score) };
}

/** 25 o más = anticuada: alcanza con no tener HTTPS (el navegador la marca "No seguro") o no tener versión para celular.
 *  Antes era 40 y esas webs pasaban por modernas (2026-11-10). */
export const OUTDATED_FROM = 25;
export function webStatusFromScore(score: number): "ok" | "outdated" {
  return score >= OUTDATED_FROM ? "outdated" : "ok";
}

// Fallas de red que pueden ser pasajeras (DNS lento, tiempo de espera): se reintenta otro día en vez de marcarla caída.
const TRANSIENT = /^(EAI_AGAIN|UND_ERR_CONNECT_TIMEOUT|ETIMEDOUT|ECONNRESET|TimeoutError|TypeError: fetch failed)/;

/** Texto visible de la portada (para que el Analista sepa qué servicios ofrece). Es texto de terceros: dato, no órdenes. */
export function htmlToText(html: string, max = 3000) {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Descarga la portada (con tiempo máximo) y la analiza. Si no responde, la web está caída. */
const FREE_BUILDERS = /(^|\.)(wixsite\.com|blogspot\.com|sites\.google\.com|weebly\.com|jimdosite\.com|jimdofree\.com|webnode\.[a-z.]+|godaddysites\.com|mystrikingly\.com|strikingly\.com|carrd\.co|wordpress\.com|site123\.me|business\.site|negocio\.site)$/i;
/** Nombre del constructor gratuito si la web vive en uno de sus subdominios (cliente.wixsite.com, x.blogspot.com…). */
export function freeBuilder(url: string) {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  if (host === "sites.google.com") return "sites.google.com";
  return host.match(FREE_BUILDERS)?.[2]?.toLowerCase() ?? null;
}

const get = (url: string) =>
  fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "Mozilla/5.0 (compatible; AgentVillage/0.1; revision de sitio)" } });

export async function checkWebsite(url: string) {
  const target = url.includes("://") ? url : `http://${url}`;
  try {
    let r = await get(target);
    // La dirección de Overture puede ser una página interna que ya no existe: antes de darla por caída, se prueba la portada.
    if (r.status === 404 && new URL(target).pathname !== "/") {
      const home = await get(new URL("/", target).href).catch(() => null);
      if (home?.ok) r = home;
    }
    if (!r.ok) return { status: "down" as const, score: 100, signals: { httpStatus: r.status } };
    const html = (await r.text()).slice(0, 500_000);
    const { signals, score } = analyzeHtml(html, r.url);
    return { status: signals.parked ? ("down" as const) : webStatusFromScore(score), score, signals };
  } catch (err) {
    const e = err as { cause?: { code?: string }; name?: string };
    const error = e.cause?.code ?? (e.name === "TimeoutError" ? "TimeoutError" : String(err).slice(0, 200));
    // "unchecked": queda para la próxima revisión. Un dominio que no existe (ENOTFOUND) sí cuenta como caída.
    return { status: TRANSIENT.test(error) ? ("unchecked" as const) : ("down" as const), score: 100, signals: { error } };
  }
}
