import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { connection } from "next/server";
import { Suspense } from "react";
import { db, schema } from "@/db";
import { isOverdue, MAINTENANCE_USD, METHODS, PACKAGES, type Method, type PackageId } from "@/sales/offers";
import { CARD_SURCHARGE_PCT } from "@/sales/billing";
import { SubmitButton } from "@/components/submit-button";
import { Chip, PageHeader, Panel } from "@/components/ui";
import { addMaintenance, markPaid, registerSale, requestSite, saveDomain } from "./actions";

const input = "p-2 text-sm";
const usd = (n: number) => `${n} USD`;
const ars = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export default function VentasPage() {
  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <PageHeader title="Ventas y cobros" />
      <p className="mb-5 text-sm text-(--av-muted)">Registro manual: el sistema nunca cobra ni mueve plata. Los precios están en dólares y anotás los pesos que recibiste. Cobro por transferencia al alias; con tarjeta, link de Mercado Pago con {CARD_SURCHARGE_PCT} % de recargo. El Cobrador prepara los recordatorios (3 días antes, a los 5 y a los 15 días de vencida) y a los 30 propone pausar el sitio: todo pasa por la bandeja.</p>
      <Suspense fallback={<p className="text-(--av-muted)">Cargando…</p>}>
        <Sales />
      </Suspense>
    </main>
  );
}

async function Sales() {
  await connection();
  const [candidates, clients] = await Promise.all([
    db.select({ id: schema.leads.id, name: schema.leads.name, stage: schema.leads.stage }).from(schema.leads).where(inArray(schema.leads.stage, ["contacted", "replied", "demo_created"])).orderBy(asc(schema.leads.name)),
    db
      .select({ client: schema.clients, name: schema.leads.name })
      .from(schema.clients)
      .innerJoin(schema.leads, eq(schema.leads.id, schema.clients.leadId))
      .orderBy(desc(schema.clients.createdAt)),
  ]);
  const payments = clients.length
    ? await db.select().from(schema.payments).where(inArray(schema.payments.clientId, clients.map((c) => c.client.id))).orderBy(sql`${schema.payments.dueDate} asc nulls last`, asc(schema.payments.createdAt))
    : [];
  const thisMonth = new Date().toISOString().slice(0, 7);

  return (
    <div className="space-y-6">
      <Panel title="Registrar una venta" collapsible defaultOpen={clients.length === 0}>
        {candidates.length === 0 ? (
          <p className="text-sm text-(--av-muted)">No hay negocios con demo o contactados para registrar. Primero preparale una demo o mandale un mensaje.</p>
        ) : (
          <form action={registerSale} className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Negocio
              <select name="leadId" required className={input}>
                {/* Primero los que dijeron que les interesa (en Mensajes o en una visita). */}
                {[
                  { label: "Les interesó", list: candidates.filter((c) => c.stage === "replied") },
                  { label: "Otros", list: candidates.filter((c) => c.stage !== "replied") },
                ].map(({ label, list }) =>
                  list.length ? (
                    <optgroup key={label} label={label}>
                      {list.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null,
                )}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Paquete
              <select name="packageId" className={input}>
                {Object.entries(PACKAGES).map(([id, p]) => (
                  <option key={id} value={id}>
                    {p.label}: {usd(p.usd)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="maintenance" /> Con mantenimiento mensual ({MAINTENANCE_USD} USD, incluye el hosting)
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Notas
              <input name="notes" maxLength={500} className={input} />
            </label>
            <SubmitButton pendingText="Guardando…" className="av-btn av-btn-coin sm:col-span-2">
              Registrar venta
            </SubmitButton>
          </form>
        )}
      </Panel>

      {clients.length === 0 && <p className="av-panel p-4 text-sm text-(--av-muted)">Todavía no hay ventas registradas. Cuando cierres la primera, aparece acá con sus cobros (50 % al empezar y 50 % al entregar).</p>}
      <ul className="space-y-4">
        {clients.map(({ client, name }) => {
          const mine = payments.filter((p) => p.clientId === client.id);
          const paidUsd = mine.filter((p) => p.status === "paid").reduce((a, p) => a + p.amountUsd, 0);
          const owedUsd = mine.filter((p) => p.status === "pending").reduce((a, p) => a + p.amountUsd, 0);
          const total = paidUsd + owedUsd;
          return (
            <li key={client.id}>
              <Panel
                title={name}
                aside={
                  <span className="text-xs text-(--av-muted)">
                    {PACKAGES[client.packageId as PackageId]?.label} · {usd(client.priceUsd)}
                    {client.maintenanceUsd && ` · mantenimiento ${usd(client.maintenanceUsd)}/mes`}
                  </span>
                }
              >
                {/* Barra de cobro: lo cobrado sobre el total cargado. */}
                <div className="mb-1 flex justify-between text-sm">
                  <span>Cobrado {usd(paidUsd)}</span>
                  <span className="text-(--av-muted)">Falta {usd(owedUsd)}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-sm border-2 border-(--av-line)" role="meter" aria-label="Cobrado" aria-valuemin={0} aria-valuemax={total} aria-valuenow={paidUsd}>
                  <div className="h-full bg-(--av-work)" style={{ width: `${total ? Math.round((paidUsd / total) * 100) : 0}%` }} />
                </div>
                <ul className="mt-4 divide-y-2 divide-(--av-sunk)">
                  {mine.map((p) => {
                    const late = isOverdue(p);
                    return (
                      <li key={p.id} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center">
                        <span className="flex flex-1 flex-wrap items-center gap-2 text-sm">
                          {p.status === "paid" ? <Chip tone="work">Cobrado</Chip> : late ? <Chip tone="stuck">Vencido</Chip> : <Chip tone="wait">Pendiente</Chip>}
                          {p.concept}: {usd(p.amountUsd)}
                          {p.dueDate && <span className="text-(--av-muted)">· vence el {p.dueDate.toLocaleDateString("es-AR")}</span>}
                        </span>
                        {p.status === "paid" ? (
                          <span className="text-sm text-(--av-muted)">
                            {p.paidArs != null && ars(p.paidArs)} ({METHODS[p.method as Method]}) el {p.paidAt?.toLocaleDateString("es-AR")}
                          </span>
                        ) : (
                          <form action={markPaid} className="flex flex-wrap items-center gap-2">
                            <input type="hidden" name="id" value={p.id} />
                            <input name="paidArs" type="number" min={1} step={1} required placeholder="Pesos recibidos" aria-label="Pesos recibidos" className={`${input} w-36`} />
                            <select name="method" aria-label="Medio de pago" className={input}>
                              {Object.entries(METHODS).map(([id, label]) => (
                                <option key={id} value={id}>
                                  {label}
                                </option>
                              ))}
                            </select>
                            <SubmitButton pendingText="Guardando…" className="av-btn text-sm">
                              Marcar cobrado
                            </SubmitButton>
                          </form>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <SiteBox client={client} />
                {client.maintenanceUsd && (
                  <form action={addMaintenance} className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <input type="hidden" name="clientId" value={client.id} />
                    <input type="month" name="month" defaultValue={thisMonth} aria-label="Mes de la cuota" className={input} />
                    <SubmitButton pendingText="Guardando…" className="av-btn text-sm">
                      Agregar cuota de mantenimiento
                    </SubmitButton>
                  </form>
                )}
              </Panel>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const SITE: Record<string, { label: string; tone: "work" | "stuck" | "idle" }> = { online: { label: "En línea", tone: "work" }, paused: { label: "En pausa", tone: "stuck" }, none: { label: "Sin publicar", tone: "idle" } };

/** Sitio y dominio del cliente (agente Hosting, Fase 7). */
function SiteBox({ client }: { client: typeof schema.clients.$inferSelect }) {
  const s = SITE[client.siteStatus] ?? SITE.none;
  return (
    <div className="av-sunk mt-4 space-y-2 p-3 text-sm">
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Sitio</span> <Chip tone={s.tone}>{s.label}</Chip>
        {client.siteUrl && (
          <a href={client.siteUrl} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">
            {client.siteUrl.replace(/^https:\/\//, "")}
          </a>
        )}
      </p>
      <form action={saveDomain} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="clientId" value={client.id} />
        <label className="flex flex-col gap-1">
          Dominio (del cliente)
          <input name="domain" defaultValue={client.domain ?? ""} placeholder="consultorio.com.ar" className={`${input} w-52`} />
        </label>
        <label className="flex flex-col gap-1">
          Vence en NIC
          <input type="date" name="renewsAt" defaultValue={client.domainRenewsAt?.toISOString().slice(0, 10) ?? ""} className={input} />
        </label>
        <SubmitButton pendingText="Guardando…" className="av-btn text-sm">
          Guardar dominio
        </SubmitButton>
      </form>
      <form action={requestSite}>
        <input type="hidden" name="clientId" value={client.id} />
        <SubmitButton pendingText="Pidiendo…" className="av-btn av-btn-coin text-sm" title="El agente Hosting arma el sitio con su demo (sin el aviso de propuesta) y te pide aprobación para subirlo a Vercel">
          {client.siteStatus === "none" ? "Preparar y publicar el sitio" : "Volver a publicar el sitio"}
        </SubmitButton>
      </form>
      <details>
        <summary className="cursor-pointer text-(--av-muted)">Cómo se conecta el dominio</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-(--av-muted)">
          <li>El cliente registra el dominio a su nombre en nic.ar (Trámites a Distancia, con su CUIT/CUIL y Clave Fiscal nivel 2). El arancel lo paga él: hoy $8.500 por año.</li>
          <li>Nunca le pidas su Clave Fiscal: si querés hacer vos los trámites, que te dé un apoderamiento en Trámites a Distancia.</li>
          <li>Al publicar, el agente agrega el dominio y el www al proyecto en Vercel, que muestra sus servidores DNS.</li>
          <li>En nic.ar, en el dominio, tocá &quot;Delegar&quot; y cargá esos servidores de Vercel. Es gratis y tarda unas horas.</li>
          <li>Cargá acá cuándo vence: el Cobrador le avisa al cliente 30 días antes para que lo renueve.</li>
        </ol>
      </details>
    </div>
  );
}
