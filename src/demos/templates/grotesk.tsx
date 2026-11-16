import type { DemoContent } from "../content";
import { splitPhotos, withBrand } from "../brand";
import { baseTokens, fontPackFor } from "../directions";
import { fontVars } from "./fonts";
import { ACCENT_BUTTON, ContactButton, DemoNotice, HeroImage, INK_BUTTON, PhoneLink, PhotoCard, StickyContact, tokenVars, Visit } from "./shared";

/** Dirección B (Jacques + Cie, OH, Kononenko): una sola grotesca, título gigante y mucho aire. Sin foto buena, el hero es el título sobre el color de marca (Plan B). */
export function GroteskTemplate({ c, expiresAt }: { c: DemoContent; expiresAt: Date }) {
  const { hero, side, gallery } = splitPhotos(c.brand);
  return (
    <div className={`font-(family-name:--body) min-h-dvh bg-(--bg) pb-24 text-(--ink) sm:pb-0`} style={{ ...tokenVars(withBrand(baseTokens("grotesk", c.brand?.palette), c.brand)), ...fontVars(fontPackFor("grotesk", c.brand?.fonts)) }}>
      <DemoNotice name={c.business.name} expiresAt={expiresAt} />

      <section className={`relative flex min-h-[88svh] flex-col px-5 pt-5 pb-8 sm:px-8 ${hero ? "bg-(--ink) text-white" : "bg-(--accent) text-(--onAccent)"}`}>
        {hero && <HeroImage photo={hero} name={c.business.name} />}
        <header className="relative flex items-center justify-between gap-4 text-sm sm:text-base">
          <p className="font-medium">{c.business.name}</p>
          <nav className="flex gap-5" aria-label="Secciones">
            <a href="#servicios" className="hover:underline">Servicios</a>
            <a href="#contacto" className="hover:underline">Contacto</a>
            <PhoneLink c={c} className="hidden hover:underline lg:block" />
          </nav>
        </header>
        {/* Foto mediana: al costado del título en pantallas grandes, arriba en el resto. */}
        {side && <PhotoCard photo={side} name={c.business.name} className="relative mt-6 aspect-4/3 rounded-(--radius) sm:max-w-md lg:absolute lg:top-20 lg:right-8 lg:mt-0 lg:aspect-4/5 lg:w-[30%] lg:max-w-none" />}
        <h1 className={`font-(family-name:--display) relative mt-auto pt-16 ${side ? "lg:max-w-[65%]" : ""} text-[clamp(3rem,7vw,8rem)] leading-[0.88] font-normal tracking-[-0.03em] text-balance`}>{c.headline}</h1>
        <div className="relative mt-8 grid gap-4 border-t border-current/30 pt-4 text-sm sm:grid-cols-3 sm:text-base">
          <p className="max-w-sm">{c.subheadline}</p>
          <p className="hidden sm:block">{c.business.address ?? "La Plata"}</p>
          <ContactButton c={c} className={`hidden w-fit rounded-(--radius) px-5 py-2.5 font-medium sm:block ${hero ? "bg-white text-(--ink)" : "bg-(--onAccent) text-(--accent)"} sm:self-start sm:justify-self-end`} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-[clamp(80px,10vw,190px)] sm:px-8">
        <p className="max-w-5xl text-[clamp(1.75rem,3.2vw,3.25rem)] leading-[1.05] tracking-[-0.02em] text-pretty">{c.about}</p>
        <ul className="mt-10 flex flex-wrap gap-2">
          {c.highlights.map((h) => (
            <li key={h} className="rounded-full border border-(--line) px-4 py-1.5 text-sm text-(--muted)">
              + {h}
            </li>
          ))}
        </ul>
      </section>

      {gallery.length > 0 && (
        <section className="mx-auto grid max-w-7xl gap-4 px-5 pb-[clamp(80px,10vw,190px)] sm:grid-cols-2 sm:px-8">
          {gallery.slice(0, 4).map((p) => (
            <PhotoCard key={p.src} photo={p} name={c.business.name} tint={!hero} className="aspect-4/3 rounded-(--radius)" />
          ))}
        </section>
      )}

      <section id="servicios" className="mx-auto max-w-7xl px-5 pb-[clamp(80px,10vw,190px)] sm:px-8">
        <h2 className="text-sm text-(--muted)">Servicios</h2>
        <ol className="mt-6 border-t border-(--line)">
          {c.services.map((s, i) => (
            <li key={s.title} className="grid gap-2 border-b border-(--line) py-7 sm:grid-cols-[4rem_1fr_1.2fr] sm:gap-8">
              <span className="text-sm text-(--muted)">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="text-2xl tracking-[-0.02em] sm:text-4xl">{s.title}</h3>
              <p className="leading-relaxed text-(--muted) sm:text-lg">{s.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer id="contacto" className="bg-(--ink) px-5 py-[clamp(64px,8vw,140px)] text-(--bg) sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-10 sm:flex-row sm:items-end sm:justify-between">
          <p className="max-w-3xl text-[clamp(2.5rem,5vw,5.5rem)] leading-[0.9] tracking-[-0.03em]">{c.ctaLabel}</p>
          <div className="space-y-5">
            <Visit c={c} className="space-y-1 text-lg" />
            <ContactButton c={c} style={ACCENT_BUTTON} className="hidden w-fit rounded-(--radius) px-6 py-3 font-medium sm:block" />
          </div>
        </div>
      </footer>

      <StickyContact c={c} style={INK_BUTTON} />
    </div>
  );
}
