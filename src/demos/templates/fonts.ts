import type { CSSProperties } from "react";
import { Anton, DM_Mono, DM_Sans, Fraunces, Hanken_Grotesk, IBM_Plex_Mono, Inter, Inter_Tight, Instrument_Serif, Manrope, Newsreader } from "next/font/google";
import type { FontPack } from "../directions";

// Todas las fuentes del pack (FONT_PACKS); cada demo elige cuáles usar con las variables --display, --body y --label.
// next/font exige una constante por fuente. Las que solo aparecen como alternativa no se precargan.
const fraunces = Fraunces({ subsets: ["latin"], weight: ["300", "400"], display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500"], display: "swap" });
const anton = Anton({ subsets: ["latin"], weight: "400", display: "swap" });
const instrumentSerif = Instrument_Serif({ subsets: ["latin"], weight: "400", display: "swap", preload: false });
const manrope = Manrope({ subsets: ["latin"], display: "swap", preload: false });
const interTight = Inter_Tight({ subsets: ["latin"], weight: ["400", "500"], display: "swap" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], display: "swap" });
const hanken = Hanken_Grotesk({ subsets: ["latin"], weight: ["300", "400", "500"], display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400"], display: "swap" });
const newsreader = Newsreader({ subsets: ["latin"], weight: ["300", "400"], display: "swap", preload: false });

const FONTS: Record<string, { style: { fontFamily: string } }> = {
  Fraunces: fraunces,
  "DM Sans": dmSans,
  Anton: anton,
  "Instrument Serif": instrumentSerif,
  Manrope: manrope,
  "Inter Tight": interTight,
  Inter: inter,
  "DM Mono": dmMono,
  "Hanken Grotesk": hanken,
  "IBM Plex Mono": plexMono,
  Newsreader: newsreader,
};

/** Variables CSS del pack elegido. */
export const fontVars = (p: FontPack) => ({ "--display": FONTS[p.display].style.fontFamily, "--body": FONTS[p.body].style.fontFamily, "--label": FONTS[p.label].style.fontFamily }) as CSSProperties;
