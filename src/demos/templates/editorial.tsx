import type { DemoContent } from "../content";
import { splitPhotos, withBrand } from "../brand";
import { baseTokens, fontPackFor } from "../directions";
import { fontVars } from "./fonts";
import { ACCENT_BUTTON, ContactButton, DemoNotice, HeroImage, PhoneLink, PhotoCard, serviceCols, StickyContact, tokenVars, Visit } from "./shared";

const section = "px-5 py-[clamp(64px,6vw,116px)]";
const display = "font-(family-name:--display)";
const label = `font-(family-name:--label) text-sm tracking-[0.12em] uppercase`;

/** Dirección A (Sage Space): fondo crema, serif fino, todo redondeado. Con una foto mediana, hero partido; sin fotos, panel de color (Plan B). */
export function EditorialTemplate({ c, expiresAt }: { c: DemoContent; expiresAt: Date }) {
  const { hero, side, gallery } = splitPhotos(c.brand);
  return (
    <div className={`font-(family-name:--body) min-h-dvh bg-(--bg) pb-24 text-(--ink) sm:pb-0`} style={{ ...tokenVars(withBrand(baseTokens("editorial", c.brand?.palette), c.brand)), ...fontVars(fontPackFor("editorial", c.brand?.fonts)) }}>
      <DemoNotice name={c.business.name} expiresAt={expiresAt} />

      <header className="mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center gap-4 px-5 py-5 sm:grid-cols-[1fr_auto_1fr]">
        <nav className="hidden gap-2 text-sm sm:flex" aria-label="Secciones">
          {[["#servicios", "Servicios"], ["#nosotros", "Nosotros"], ["#visitanos", "Visitanos"]].map(([href, text]) => (
            <a key={href} href={href} className="rounded-full border border-(--line) px-4 py-2 hover:bg-(--line)">
              {text}
            </a>
          ))}
        </nav>
        <p className={`${display} text-2xl sm:text-center`}>{c.business.name}</p>
        <div className="flex items-center justify-self-end gap-4">
          <PhoneLink c={c} className="hidden text-sm lg:block" />
          <ContactButton c={c} style={ACCENT_BUTTON} className="hidden rounded-full px-5 py-2.5 text-sm font-medium sm:block" />
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5">
        <div className={`relative grid overflow-hidden rounded-(--radius) ${hero ? "text-white" : "bg-(--card)"} ${side ? "sm:grid-cols-2" : ""}`}>
          {hero && <HeroImage photo={hero} name={c.business.name} />}
          {side && <PhotoCard photo={side} name={c.business.name} className="aspect-4/3 sm:order-last sm:aspect-auto sm:min-h-140" />}
          <div className={`relative flex flex-col justify-end p-6 sm:p-12 ${side ? "" : "min-h-[70svh] sm:min-h-140"}`}>
            <h1 className={`${display} relative max-w-3xl text-[clamp(2.5rem,4vw+1rem,3.5rem)] leading-[0.9] font-light tracking-[-0.02em] text-balance`}>{c.headline}</h1>
            <p className="relative mt-5 max-w-xl text-lg leading-relaxed text-pretty sm:text-xl">{c.subheadline}</p>
            <div className="relative mt-8 flex flex-wrap gap-3">
              <ContactButton c={c} style={ACCENT_BUTTON} className="hidden rounded-full px-7 py-3.5 font-medium sm:inline-block" />
              <a href="#servicios" className="rounded-full border border-current px-7 py-3.5 font-medium">
                Ver servicios
              </a>
            </div>
          </div>
        </div>
      </section>

      <ul className="mx-auto mt-[clamp(48px,5vw,80px)] grid max-w-6xl divide-y divide-(--line) border-y border-(--line) px-5 sm:auto-cols-fr sm:grid-flow-col sm:divide-x sm:divide-y-0">
        {c.highlights.map((h) => (
          <li key={h} className="py-6 text-lg sm:px-6 sm:first:pl-0">
            {h}
          </li>
        ))}
      </ul>

      {gallery.length > 0 && (
        <section className="mx-auto mt-[clamp(48px,5vw,80px)] grid max-w-6xl grid-cols-2 gap-4 px-5 sm:grid-cols-3">
          {gallery.slice(0, 3).map((p) => (
            <PhotoCard key={p.src} photo={p} name={c.business.name} tint={!hero} className="aspect-3/4 rounded-(--radius)" />
          ))}
        </section>
      )}

      <section id="servicios" className={`mx-auto max-w-6xl ${section}`}>
        <h2 className={label}>Servicios</h2>
        <ul className={`mt-8 grid gap-4 ${serviceCols(c.services.length)}`}>
          {c.services.map((s) => (
            <li key={s.title} className="rounded-(--radius) border border-(--line) p-7">
              <h3 className={`${display} text-2xl`}>{s.title}</h3>
              <p className="mt-3 leading-relaxed text-(--muted)">{s.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="nosotros" className="bg-(--accent) text-(--onAccent)">
        <div className={`mx-auto max-w-4xl ${section}`}>
          <h2 className={label}>Nosotros</h2>
          <p className={`${display} mt-6 text-2xl leading-snug font-light text-pretty sm:text-4xl`}>{c.about}</p>
        </div>
      </section>

      <footer id="visitanos" className={`mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between ${section}`}>
        <div>
          <h2 className={label}>Visitanos</h2>
          <Visit c={c} className="mt-4 space-y-1 text-lg" />
        </div>
        <ContactButton c={c} style={ACCENT_BUTTON} className="hidden rounded-full px-7 py-3.5 font-medium sm:inline-block" />
      </footer>

      <StickyContact c={c} style={ACCENT_BUTTON} />
    </div>
  );
}
