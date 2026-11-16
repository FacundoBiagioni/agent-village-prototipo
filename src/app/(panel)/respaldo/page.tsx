import { Suspense } from "react";
import { connection } from "next/server";
import { PageHeader, Panel } from "@/components/ui";
// PROTOTIPO: no hay respaldos reales (el original arma un .zip con la base y las fotos).
const backupPreview = async () => ({ checkpoint: null as { at: string } | null, photosAll: 0, photosNew: 0, dbBytes: 4_800_000 });

const mb = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const when = (iso: string) => new Date(iso).toLocaleString("es-AR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export default function RespaldoPage() {
  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <PageHeader title="Copia de seguridad" />
      <p className="mb-5 text-sm text-(--av-muted)">
        Un archivo .zip para guardar en un pendrive. Trae la base completa (negocios, demos, mensajes, ventas, visitas y plantillas) y las fotos de las demos. No trae tus claves (.env) ni tu contraseña. Además, la PC hace sola una copia de la base todos los días en el disco E:.
      </p>
      <Suspense fallback={<Panel title="Descargar">Cargando…</Panel>}>
        <Options />
      </Suspense>
    </main>
  );
}

async function Options() {
  await connection();
  const p = await backupPreview();
  const last = p.checkpoint;
  return (
    <div className="space-y-6">
      <Panel title="Descargar" aside={last && <span className="text-xs text-(--av-muted)">Último punto de guardado: {when(last.at)}</span>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <form method="post" action="/respaldo/descargar" className="av-sunk flex flex-col gap-2 p-3 text-sm">
            <input type="hidden" name="modo" value="todo" />
            <span className="av-title text-base">Todo</span>
            <span className="text-(--av-muted)">
              La base y las {p.photosAll} fotos. Base: unos {mb(p.dbBytes)} sin comprimir. Conviene cada tanto, y siempre en un pendrive nuevo.
            </span>
            <button className="av-btn av-btn-coin mt-auto">Descargar todo</button>
          </form>
          <form method="post" action="/respaldo/descargar" className="av-sunk flex flex-col gap-2 p-3 text-sm">
            <input type="hidden" name="modo" value="nuevo" />
            <span className="av-title text-base">Solo lo nuevo</span>
            <span className="text-(--av-muted)">
              {last ? `La base completa (pesa poco) y las ${p.photosNew} foto(s) nuevas desde el ${when(last.at)}.` : "Todavía no hay un punto de guardado: la primera vez sale igual que \"Todo\"."}
            </span>
            <button className="av-btn mt-auto">Descargar lo nuevo</button>
          </form>
        </div>
        <p className="mt-3 text-xs text-(--av-muted)">Cada descarga deja ese momento como nuevo punto de guardado. Puede tardar unos segundos en empezar.</p>
      </Panel>
      <Panel title="Si alguna vez hay que restaurar" collapsible defaultOpen={false}>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>La base sale de la copia más reciente: cualquiera de los dos tipos la trae completa.</li>
          <li>Las fotos: las de la última copia &quot;Todo&quot; y, después, en orden, las de cada copia &quot;Solo lo nuevo&quot; posterior.</li>
          <li>Cada .zip trae un LEEME.txt con los pasos. Lo más simple es pedírselo a Claude Code con los archivos a mano.</li>
        </ol>
      </Panel>
    </div>
  );
}
