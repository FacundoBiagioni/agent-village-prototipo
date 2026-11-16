import type { Photo } from "../brand";
import { HERO_WIDTH, withBrand } from "../brand";
import type { DemoContent } from "../content";
import { baseTokens, fontPackFor } from "../directions";
import { fontVars } from "./fonts";
import { ACCENT_BUTTON, ContactButton, DemoNotice, PhoneLink, PhotoCard, StickyContact, tokenVars, Visit } from "./shared";

export const STUDIO_PAGES = ["proyectos", "estudio"] as const;
export type StudioPage = "inicio" | (typeof STUDIO_PAGES)[number];

/** Dirección D, para estudios de arquitectura: 3 páginas (Inicio, Proyectos, Estudio), ángulos rectos, fotos grandes y mucho aire.
 *  Sin fotos, Proyectos muestra marcos vacíos "para tus obras" (no se inventan proyectos). */
export function StudioTemplate({ c, expiresAt, page = "inicio", base }: { c: DemoContent; expiresAt: Date; page?: StudioPage; base: string }) {
  const photos = c.brand?.photos ?? [];
  return (
    <div className="font-(family-name:--body) min-h-dvh bg-(--bg) pb-24 text-(--ink) sm:pb-0" style={{ ...tokenVars(withBrand(baseTokens("studio", c.brand?.palette), c.brand)), ...fontVars(fontPackFor("studio", c.brand?.fonts)) }}>
      <DemoNotice name={c.business.name} expiresAt={expiresAt} />
      <Header c={c} page={page} base={base} />
      <main>
        {page === "inicio" && <Home c={c} photos={photos} base={base} />}
        {page === "proyectos" && <Projects c={c} photos={photos} />}
        {page === "estudio" && <Studio c={c} photo={photos[1] ?? photos[0]} />}
      </main>
      <Footer c={c} />
      <StickyContact c={c} style={ACCENT_BUTTON} what="consulta" />
    </div>
  );
}

const label = "font-(family-name:--label) text-xs tracking-[0.12em] uppercase text-(--muted)";
const wrap = "mx-auto max-w-7xl px-5 sm:px-8";

function Header({ c, page, base }: { c: DemoContent; page: StudioPage; base: string }) {
  const links: [StudioPage, string, string][] = [
    ["proyectos", "Proyectos", `${base}/proyectos`],
    ["estudio", "Estudio", `${base}/estudio`],
  ];
  return (
    <header className={`${wrap} flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-b border-(--line) py-5`}>
      <a href={base} className="text-lg font-medium tracking-[-0.01em]" aria-current={page === "inicio" ? "page" : undefined}>
        {c.business.name}
      </a>
      <nav aria-label="Páginas" className="flex gap-6 text-sm">
        {links.map(([id, text, href]) => (
          <a key={id} href={href} aria-current={page === id ? "page" : undefined} className="underline-offset-4 hover:underline aria-[current=page]:underline">
            {text}
          </a>
        ))}
        <a href="#contacto" className="underline-offset-4 hover:underline">
          Contacto
        </a>
        <PhoneLink c={c} className="hidden text-(--muted) hover:underline lg:block" />
      </nav>
    </header>
  );
}

function Home({ c, photos, base }: { c: DemoContent; photos: Photo[]; base: string }) {
  // A todo el ancho solo una foto grande: estirar una chica la deja borrosa. Las chicas van de a dos.
  const first = photos.find((p) => p.w >= HERO_WIDTH);
  const rest = photos.filter((p) => p !== first);
  return (
    <>
      <section className={`${wrap} grid gap-10 pt-[clamp(48px,8vw,120px)] pb-[clamp(48px,6vw,96px)] lg:grid-cols-12`}>
        <h1 className="font-(family-name:--display) text-[clamp(2.6rem,6.4vw,6.5rem)] leading-[0.95] font-light tracking-[-0.035em] text-balance lg:col-span-9">{c.headline}</h1>
        <div className="space-y-6 self-end lg:col-span-3">
          <p className="leading-relaxed text-(--muted)">{c.subheadline}</p>
          <ContactButton c={c} what="consulta" style={ACCENT_BUTTON} className="hidden w-fit px-5 py-3 text-sm font-medium sm:block" />
        </div>
      </section>

      {first ? (
        <section className={wrap}>
          <PhotoCard photo={first} name={c.business.name} className="aspect-video w-full" />
        </section>
      ) : (
        <div className={wrap} aria-hidden>
          <div className="h-px bg-(--ink)" />
        </div>
      )}

      <section className={`${wrap} grid gap-10 py-[clamp(64px,9vw,160px)] lg:grid-cols-12`}>
        <p className={`${label} lg:col-span-3`}>Qué hacemos</p>
        <ol className="border-t border-(--line) lg:col-span-9">
          {c.services.map((s, i) => (
            <li key={s.title} className="grid gap-2 border-b border-(--line) py-6 sm:grid-cols-[3.5rem_1fr_1.3fr] sm:gap-8">
              <span className="font-(family-name:--label) text-sm text-(--muted)">{String(i + 1).padStart(2, "0")}</span>
              <h2 className="text-xl tracking-[-0.01em] sm:text-2xl">{s.title}</h2>
              <p className="leading-relaxed text-(--muted)">{s.description}</p>
            </li>
          ))}
        </ol>
      </section>

      {rest.length > 0 && (
        <section className={`${wrap} grid gap-4 pb-[clamp(48px,6vw,96px)] sm:grid-cols-2`}>
          {rest.slice(0, 2).map((p) => (
            <PhotoCard key={p.src} photo={p} name={c.business.name} className="aspect-4/3" />
          ))}
        </section>
      )}

      {/* Sitio de varias páginas: las otras dos, siempre a mano (con o sin fotos). */}
      <nav aria-label="Más del estudio" className={`${wrap} grid pb-[clamp(64px,9vw,160px)] sm:grid-cols-2`}>
        {[
          [`${base}/proyectos`, "Proyectos", "Obras y trabajos del estudio"],
          [`${base}/estudio`, "Estudio", "Cómo trabajamos"],
        ].map(([href, title, sub]) => (
          <a key={href} href={href} className="group flex items-end justify-between gap-4 border-t border-(--ink) py-6 sm:odd:mr-4">
            <span>
              <span className="font-(family-name:--display) block text-[clamp(1.75rem,3vw,2.75rem)] font-light tracking-[-0.02em]">{title}</span>
              <span className={label}>{sub}</span>
            </span>
            <span aria-hidden className="text-2xl transition-transform group-hover:translate-x-1">→</span>
          </a>
        ))}
      </nav>
    </>
  );
}

function Projects({ c, photos }: { c: DemoContent; photos: Photo[] }) {
  return (
    <section className={`${wrap} py-[clamp(48px,8vw,120px)]`}>
      <h1 className="font-(family-name:--display) text-[clamp(2.4rem,5vw,4.5rem)] leading-none font-light tracking-[-0.03em]">Proyectos</h1>
      {photos.length > 0 ? (
        <ul className="mt-12 grid gap-x-4 gap-y-10 sm:grid-cols-2">
          {photos.map((p, i) => (
            <li key={p.src} className={p.w >= HERO_WIDTH ? "sm:col-span-2" : ""}>
              <PhotoCard photo={p} name={c.business.name} className={p.w >= HERO_WIDTH ? "aspect-video" : "aspect-4/3"} />
              <p className={`${label} mt-3`}>Obra {String(i + 1).padStart(2, "0")}</p>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <p className="mt-6 max-w-xl leading-relaxed text-(--muted)">Este espacio es para tus obras: fotos, ubicación y año de cada proyecto, con una página propia si querés contarlo en detalle.</p>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Lugares para proyectos">
            {c.services.slice(0, 3).map((s, i) => (
              <li key={s.title} className="grid aspect-4/5 content-between border border-(--line) bg-(--card) p-5">
                <span className="font-(family-name:--label) text-sm text-(--muted)">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <span className="block text-lg">{s.title}</span>
                  <span className={label}>Tu proyecto acá</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Studio({ c, photo }: { c: DemoContent; photo?: Photo }) {
  return (
    <section className={`${wrap} grid gap-12 py-[clamp(48px,8vw,120px)] lg:grid-cols-12`}>
      <div className="lg:col-span-7">
        <h1 className="font-(family-name:--display) text-[clamp(2.4rem,5vw,4.5rem)] leading-none font-light tracking-[-0.03em]">Estudio</h1>
        <p className="mt-10 text-[clamp(1.25rem,2.2vw,1.75rem)] leading-snug tracking-[-0.01em] text-pretty">{c.about}</p>
        <ul className="mt-10 border-t border-(--line)">
          {c.highlights.map((h) => (
            <li key={h} className="border-b border-(--line) py-4">
              {h}
            </li>
          ))}
        </ul>
      </div>
      {photo ? (
        <PhotoCard photo={photo} name={c.business.name} className="aspect-4/5 lg:col-span-5" />
      ) : (
        <div className="self-end border-t border-(--ink) pt-6 lg:col-span-4 lg:col-start-9">
          <p className={label}>Qué hacemos</p>
          <ul className="mt-4 space-y-2 text-lg">
            {c.services.map((s) => (
              <li key={s.title}>{s.title}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Footer({ c }: { c: DemoContent }) {
  return (
    <footer id="contacto" className="bg-(--ink) py-[clamp(64px,8vw,140px)] text-(--bg)">
      <div className={`${wrap} flex flex-col gap-10 sm:flex-row sm:items-end sm:justify-between`}>
        <p className="font-(family-name:--display) max-w-3xl text-[clamp(2.2rem,4.5vw,4.5rem)] leading-[0.95] font-light tracking-[-0.03em]">{c.ctaLabel}</p>
        <div className="space-y-5">
          <Visit c={c} className="space-y-1" />
          <ContactButton c={c} what="consulta" style={{ background: "var(--bg)", color: "var(--ink)" }} className="hidden w-fit px-6 py-3 font-medium sm:block" />
        </div>
      </div>
    </footer>
  );
}
