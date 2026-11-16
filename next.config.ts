import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Abajo a la izquierda está el menú del panel (energía, día/noche): el indicador de Next va a la derecha.
  devIndicators: { position: "bottom-right" },
  // PROTOTIPO: la base inventada y las skills se leen del disco en el servidor; Vercel tiene que incluirlas.
  // PGlite carga su motor (WebAssembly) desde su propia carpeta: si se empaqueta, no lo encuentra.
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingIncludes: { "/**": ["./prototype/db.tar.gz", "./.claude/skills/**/*"] },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
