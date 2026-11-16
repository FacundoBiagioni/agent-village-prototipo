// Política de cobro (Fase 7, recomendación aprobada para empezar el 2026-11-12; se ajusta con el uso).
// Cobro por transferencia al alias (sin comisión). Con tarjeta, un link de Mercado Pago con recargo para cubrir su comisión.
// Nada sale solo: cada recordatorio es un mensaje que el usuario aprueba en la bandeja y manda desde su celular.

export const CARD_SURCHARGE_PCT = 8; // ~6,6 % + IVA de Mercado Pago al instante (referencia 2026-11, sin confirmar en su web)
export const DOMAIN_FEE_ARS = 8500; // arancel anual de un .com.ar en nic.ar/es/dominios/aranceles (leído el 2026-11-12)

export type Stage = "antes" | "vencido" | "aviso_final" | "pausa" | "dominio";
const DAY = 86_400_000;

/** Días respecto del vencimiento en que se dispara cada etapa. La pausa solo existe para el mantenimiento (hay un sitio que pausar). */
export const MAINTENANCE_STEPS: [Stage, number][] = [["antes", -3], ["vencido", 5], ["aviso_final", 15], ["pausa", 30]];
export const ONE_OFF_STEPS: [Stage, number][] = [["vencido", 3], ["aviso_final", 10]];
export const DOMAIN_NOTICE_DAYS = 30;

export const isMaintenance = (concept: string) => concept.startsWith("Mantenimiento");

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** La etapa más avanzada a la que llegó un pago pendiente (si la PC estuvo apagada, no se mandan las anteriores). null: nada que hacer. */
export function dueStage(p: { status: string; concept: string; dueDate: Date | null }, now = new Date()): Stage | null {
  if (p.status !== "pending" || !p.dueDate) return null;
  const days = Math.round((startOfDay(now).getTime() - startOfDay(p.dueDate).getTime()) / DAY);
  let out: Stage | null = null;
  for (const [stage, at] of isMaintenance(p.concept) ? MAINTENANCE_STEPS : ONE_OFF_STEPS) if (days >= at) out = stage;
  return out;
}

/** Fecha en que se pausaría el sitio por esa cuota. */
export const pauseDate = (dueDate: Date) => new Date(startOfDay(dueDate).getTime() + 30 * DAY);

/** ¿Hay que avisarle al cliente que renueve su dominio? */
export const domainNoticeDue = (renewsAt: Date | null, now = new Date()) => !!renewsAt && renewsAt.getTime() - now.getTime() <= DOMAIN_NOTICE_DAYS * DAY && renewsAt.getTime() > now.getTime() - 7 * DAY;

const fecha = (d: Date) => d.toLocaleDateString("es-AR", { day: "numeric", month: "long" });

export type PayInfo = { alias: string; holder: string; seller: string };

/** Texto del recordatorio (voseo, sin emojis, cordial y firme). Lo arma el código: no inventa montos ni fechas. */
export function reminderText(stage: Stage, x: { concept: string; amountUsd: number; dueDate: Date | null; domain?: string | null; domainRenewsAt?: Date | null }, pay: PayInfo) {
  const howToPay = `Podés transferir al alias ${pay.alias} (a nombre de ${pay.holder}). Si preferís pagar con tarjeta, avisame y te paso un link de Mercado Pago (tiene un recargo del ${CARD_SURCHARGE_PCT} % por la comisión).`;
  const amount = `${x.amountUsd} USD (en pesos, al valor del día en que pagues)`;
  const what = isMaintenance(x.concept) ? `la cuota de ${x.concept.toLowerCase().replace(/ (\d{4})-(\d{2})$/, " de $2/$1")}` : `el pago de ${x.concept.toLowerCase()}`;
  const due = x.dueDate ? fecha(x.dueDate) : "";
  const lines: Record<Stage, string> = {
    antes: `Hola, ¿cómo estás? Te recuerdo que el ${due} vence ${what} de tu sitio: ${amount}. ${howToPay}`,
    vencido: `Hola, ¿cómo estás? Te escribo porque ${what} venció el ${due} y todavía no me figura el pago: ${amount}. Si ya transferiste, mandame el comprobante y lo reviso. ${howToPay}`,
    aviso_final: isMaintenance(x.concept)
      ? `Hola, ¿cómo estás? ${capital(what)} sigue pendiente desde el ${due} (${amount}). Para que el sitio siga en línea necesito que quede al día antes del ${x.dueDate ? fecha(pauseDate(x.dueDate)) : ""}; si no, queda en pausa hasta regularizarlo (no se pierde nada y se reactiva apenas se pague). Si necesitás otra fecha, escribime y lo charlamos. ${howToPay}`
      : `Hola, ¿cómo estás? ${capital(what)} sigue pendiente desde el ${due} (${amount}). ¿Me confirmás cuándo podés hacerlo? Si necesitás otra fecha, escribime y lo charlamos. ${howToPay}`,
    pausa: `Hola, ¿cómo estás? Como ${what} sigue pendiente desde el ${due}, el sitio quedó en pausa. Apenas se regularice (${amount}) lo vuelvo a poner en línea, con todo como estaba. ${howToPay}`,
    dominio: `Hola, ¿cómo estás? Te aviso que el dominio ${x.domain} vence el ${x.domainRenewsAt ? fecha(x.domainRenewsAt) : ""}. Se renueva en nic.ar con tu CUIT/CUIL y Clave Fiscal (el arancel vigente es de $${DOMAIN_FEE_ARS.toLocaleString("es-AR")} por año). Si querés, te ayudo a hacerlo. Si no se renueva, el sitio deja de verse en esa dirección.`,
  };
  return `${lines[stage]}\n\n${pay.seller}`;
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
