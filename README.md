# Agent Village · prototipo de muestra

> **Modelo de muestra.** Esta es una copia de la interfaz de Agent Village con datos inventados, hecha para mostrar el proyecto en mi portfolio. **No funciona a propósito**: los botones no hacen nada y los agentes no corren. El Agent Village real corre por ahora solo en mi computadora, con su propia base de datos y sus agentes.
>
> **Sample model.** A copy of the Agent Village interface with made-up data, built to show the project in my portfolio. **It does not work on purpose**: buttons do nothing and no agent runs. The real Agent Village currently runs only on my own computer.

## Qué es Agent Village

Un equipo de agentes de IA que trabaja para mí: busca negocios locales sin página web, analiza cada uno, le arma una demo de sitio y redacta el primer mensaje. **Nada sale hacia afuera sin mi aprobación**: cada mensaje o publicación espera un clic mío en la bandeja.

- **Agentes:** Analista, Diseñador, Comunicador, Encargado (supervisor), Cobrador y Hosting.
- **Interfaz:** una casa 3D low poly donde cada agente trabaja en su escritorio, con un HUD de juego (bandeja, negocios, taller, caja, pizarrón, tienda de skills).
- **Cerebros:** reglas en código cuando alcanza, un modelo local (Ollama) para lo simple y Claude para lo que necesita criterio.

## Qué cambia en este prototipo

| Original | Prototipo |
|---|---|
| PostgreSQL local con datos reales | Base en memoria ([PGlite](https://pglite.dev)) que arranca desde `prototype/db.tar.gz`, con 150 negocios **inventados** |
| Acciones del servidor (crear tareas, aprobar, enviar, cobrar) | Mismos nombres, pero no hacen nada (`"use server"` vacíos) |
| Worker con los agentes, cola de tareas y Claude Agent SDK | No existe: ningún agente corre |
| Login con contraseña | Sin login |
| Eventos en vivo | Desactivados |
| Precios reales | Precios de ejemplo |

Lo único que funciona es leer: navegar el panel, abrir negocios, ver demos, plantillas y métricas, y buscar dentro de los datos inventados.

## Correrlo

```bash
npm install
npm run build
npm start          # http://localhost:3000
```

`npm run seed` vuelve a generar `prototype/db.tar.gz` (datos inventados con semilla fija: siempre salen iguales). Las plantillas de demos de `prototype/source.json` son diseños con huecos (`{{nombre}}`, `{{telefono}}`), sin datos de nadie.

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 · Three.js · Leaflet · Drizzle ORM · PGlite (en el original: PostgreSQL, pg-boss, Claude Agent SDK y Ollama).

---

Hecho por [Facundo Biagioni](https://github.com/FacundoBiagioni).
