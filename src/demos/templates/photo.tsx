import type { DemoContent } from "../content";
import { splitPhotos, withBrand } from "../brand";
import { baseTokens, fontPackFor } from "../directions";
import { fontVars } from "./fonts";
import { ACCENT_BUTTON, ContactButton, DemoNotice, HeroImage, INK_BUTTON, PhoneLink, PhotoCard, serviceCols, StickyContact, tokenVars, Visit } from "./shared";


const mono = `font-(family-name:--label) text-xs tracking-[0.08em] uppercase`;

/** Dirección C (The Simple Gym, Concept Barre): una foto a pantalla completa teñida de un solo tono, y tarjetas blancas.
 *  Sin foto buena, el tono solo (Plan B). */
export function PhotoTemplate({ c, expiresAt }: { c: DemoContent; expiresAt: Date }) {
  const split = splitPhotos(c.brand);
  // Una foto mediana también va de fondo: el tinte de la marca disimula que tenga menos resolución.
  const hero = split.hero ?? split.side;
  const gallery = split.gallery;
  return (
    <div className={`font-(family-name:--body) min-h-dvh bg-(--bg) pb-24 text-(--ink) sm:pb-0`} style={{ ...tokenVars(withBrand(baseTokens("photo", c.brand?.palette), c.brand)), ...fontVars(fontPackFor("photo", c.brand?.fonts)) }}>
      <DemoNotice name={c.business.name} expiresAt={expiresAt} />

      <section className={`relative flex min-h-[92svh] flex-col overflow-hidden bg-(--accent) p-4 sm:p-6 ${hero ? "text-white" : "text-(--onAccent)"}`}>
        {hero && (
          <>
            <HeroImage photo={hero} name={c.business.name} veil="bg-black/35" />
            {/* El tono dominante de la ficha: la foto teñida con el color de la marca. */}
            <div className="absolute inset-0 bg-(--accent) opacity-45 mix-blend-multiply" aria-hidden />
          </>
        )}
        <header className="relative flex items-center justify-between gap-4">
          <p className="font-semibold tracking-tight">{c.business.name}</p>
          <div className="flex items-center gap-4">
            <PhoneLink c={c} className="hidden font-medium lg:block" />
            <a href="#clases" className={`${mono} rounded-full border border-current px-4 py-2`}>
              Menú
            </a>
          </div>
        </header>
        {c.highlights[0] && (
          <aside className="relative mt-6 max-w-xs rounded-(--radius) bg-(--card) p-5 text-(--ink)">
            <p className={mono}>Novedad</p>
            <p className="mt-2 font-medium">{c.highlights[0]}</p>
          </aside>
        )}
        <div className="relative m-auto max-w-3xl py-16 text-center">
          <h1 className="font-(family-name:--display) text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.95] font-semibold tracking-[-0.03em] text-balance">{c.headline}</h1>
          <p className="mx-auto mt-5 max-w-lg text-lg text-pretty">{c.subheadline}</p>
        </div>
        <ContactButton c={c} className="absolute right-6 bottom-6 hidden rounded-full bg-(--card) px-6 py-3.5 font-semibold text-(--ink) shadow-lg sm:block" />
      </section>

      <section id="clases" className="mx-auto max-w-6xl px-4 py-[clamp(64px,8vw,120px)] sm:px-6">
        <p className={mono}>{c.ctaLabel}</p>
        <ul className={`mt-6 grid gap-4 ${serviceCols(c.services.length)}`}>
          {c.services.map((s, i) => (
            <li key={s.title} className="flex flex-col rounded-(--radius) bg-(--card) p-6">
              <span className={`${mono} text-(--muted)`}>{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-10 text-2xl font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-(--muted)">{s.description}</p>
            </li>
          ))}
        </ul>
      </section>

      {gallery.length > 0 && (
        <section className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 pb-[clamp(64px,8vw,120px)] sm:grid-cols-3 sm:px-6">
          {gallery.slice(0, 3).map((p) => (
            <PhotoCard key={p.src} photo={p} name={c.business.name} tint={!hero} className="aspect-square rounded-(--radius)" />
          ))}
        </section>
      )}

      <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-[clamp(64px,8vw,120px)] sm:px-6 md:grid-cols-[1.4fr_1fr]">
        <p className="text-2xl leading-snug font-medium tracking-tight text-pretty sm:text-3xl">{c.about}</p>
        <ul className="space-y-3 self-center">
          {c.highlights.slice(1).map((h) => (
            <li key={h} className="border-b border-(--line) pb-3">
              {h}
            </li>
          ))}
        </ul>
      </section>

      <footer className="bg-(--ink) px-4 py-12 text-(--bg) sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <Visit c={c} className="space-y-1" />
          <ContactButton c={c} style={ACCENT_BUTTON} className="hidden w-fit rounded-full px-6 py-3 font-semibold sm:block" />
        </div>
      </footer>

      <StickyContact c={c} style={INK_BUTTON} />
    </div>
  );
}
