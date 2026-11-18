// Rabattkoder för Vävd.
// Koderna (procent, kategori, giltighet, minsta belopp) ligger i databasen, tabellen `rabattkoder`.
// Här finns reglerna för hur de tillämpas.
//
// Regel 1: En rabattkod gäller ALDRIG på rea-plagg. Rabatten räknas bara på fullprisvaror.
// Regel 2: Om koden har en kategori gäller den bara varor i den kategorin.
// Regel 3: min_belopp jämförs mot summan av de varor koden FAKTISKT gäller för, inte hela varukorgen.
// Regel 4: Varje kund kan använda en kod en gång (se tabellen `anvanda_koder`).
// Regel 5: Koden gäller till och med `giltig_till`.

type Kod = { kod: string; procent: number; kategori: string | null; giltig_till: string; min_belopp: number };
type Rad = { produkt: string; kategori: string; pris: number; var_rea: boolean };

export type Kodresultat =
  | "OK"
  | "KOD_FINNS_INTE"
  | "KOD_UTGANGEN"
  | "KOD_REDAN_ANVAND"
  | "INGA_GILTIGA_VAROR" // t.ex. bara rea-varor i korgen
  | "UNDER_MINSTA_BELOPP";

export function tillampbaraRader(kod: Kod, rader: Rad[]): Rad[] {
  return rader.filter((r) => !r.var_rea && (kod.kategori === null || r.kategori === kod.kategori));
}

export function kontrolleraKod(kod: Kod | null, rader: Rad[], kundHarAnvant: boolean, idag = new Date()): Kodresultat {
  if (!kod) return "KOD_FINNS_INTE";
  if (new Date(kod.giltig_till) < new Date(idag.toDateString())) return "KOD_UTGANGEN";
  if (kundHarAnvant) return "KOD_REDAN_ANVAND";
  const raderOk = tillampbaraRader(kod, rader);
  if (raderOk.length === 0) return "INGA_GILTIGA_VAROR";
  const summa = raderOk.reduce((s, r) => s + r.pris, 0);
  if (summa < kod.min_belopp) return "UNDER_MINSTA_BELOPP";
  return "OK";
}
