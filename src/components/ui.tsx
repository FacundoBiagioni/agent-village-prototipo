// Piezas compartidas del panel (estilo "juego de oficina"): título de página, panel y chip de estado.

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-3xl leading-none">{title}</h1>
      {children}
    </header>
  );
}

/** Panel del juego: contorno de tinta y sombra dura. `tone` pinta la franja del título (bandeja = espera, etc.).
 *  `collapsible`: se pliega tocando el título (details/summary nativo: funciona sin JavaScript y con teclado). */
export function Panel({ title, aside, tone, children, className = "", collapsible, defaultOpen = true }: { title: string; aside?: React.ReactNode; tone?: Tone; children: React.ReactNode; className?: string; collapsible?: boolean; defaultOpen?: boolean }) {
  const head = { background: tone ? `color-mix(in oklab, ${TONES[tone]} 28%, var(--av-card))` : undefined };
  if (collapsible)
    return (
      <details open={defaultOpen} className={`av-panel group overflow-hidden ${className}`}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 group-open:border-b-2 group-open:border-(--av-line) [&::-webkit-details-marker]:hidden" style={head}>
          <h2 className="flex items-center gap-2 text-lg leading-tight">
            <span aria-hidden className="inline-block transition-transform group-open:rotate-90">▸</span>
            {title}
          </h2>
          {aside}
        </summary>
        <div className="p-4">{children}</div>
      </details>
    );
  return (
    <section className={`av-panel overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b-2 border-(--av-line) px-4 py-2" style={tone ? { background: `color-mix(in oklab, ${TONES[tone]} 28%, var(--av-card))` } : undefined}>
        <h2 className="text-lg leading-tight">{title}</h2>
        {aside}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

const TONES = { work: "var(--av-work)", wait: "var(--av-wait)", stuck: "var(--av-stuck)", sleep: "var(--av-sleep)", idle: "var(--av-idle)", coin: "var(--av-coin)" } as const;
export type Tone = keyof typeof TONES;

/** Estado con punto de color y texto (el color nunca va solo). */
export function Chip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full border-2 border-(--av-line) bg-(--av-card) px-2 py-0.5 text-xs font-medium">
      <span className="size-2 rounded-full" style={{ background: TONES[tone] }} aria-hidden />
      {children}
    </span>
  );
}
