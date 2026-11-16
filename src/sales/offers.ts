// Oferta aprobada el 2026-10-30 (mantenimiento ajustado el 2026-11-12) (PLAN 12, DECISIONS.md). shortcut: precios en código; pasarlos a la tabla `offers` si cambian seguido.
export const PACKAGES = {
  // PROTOTIPO: precios de ejemplo, no son los reales.
  landing_basica: { label: "Landing básica", usd: 100 },
  landing_turnos: { label: "Landing + turnos online", usd: 200 },
  multi_pagina: { label: "Sitio de varias páginas", usd: 300 },
} as const;
export type PackageId = keyof typeof PACKAGES;
// 25 USD/mes desde 2026-11-12 (antes 15): incluye el hosting en Vercel Pro (20 USD/mes), así el primer cliente ya no da pérdida.
export const MAINTENANCE_USD = 20; // PROTOTIPO: de ejemplo

export const METHODS = { alias_mp: "Alias de Mercado Pago", transferencia: "Transferencia", link_mp: "Link de Mercado Pago (tarjeta)", efectivo: "Efectivo" } as const;
export type Method = keyof typeof METHODS;

/** Cobro 50 / 50 (PLAN 12): anticipo al aceptar (vence hoy) y saldo al publicar (sin fecha). */
export function splitPayments(priceUsd: number, today = new Date()) {
  const advance = Math.ceil(priceUsd / 2);
  return [
    { concept: "Anticipo 50 %", amountUsd: advance, dueDate: today },
    { concept: "Saldo 50 % (al publicar)", amountUsd: priceUsd - advance, dueDate: null },
  ];
}

export function isOverdue(p: { status: string; dueDate: Date | null }, now = new Date()) {
  if (p.status !== "pending" || !p.dueDate) return false;
  const endOfDue = new Date(p.dueDate);
  endOfDue.setHours(23, 59, 59, 999);
  return endOfDue < now;
}

/** Cuota de mantenimiento del mes indicado ("2026-11"), vence el día 10 de ese mes. */
export function maintenancePayment(month: string, amountUsd = MAINTENANCE_USD) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Mes inválido");
  const [y, m] = month.split("-").map(Number);
  return { concept: `Mantenimiento ${month}`, amountUsd, dueDate: new Date(y, m - 1, 10) };
}
