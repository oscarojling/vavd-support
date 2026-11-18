// Returregler för Vävd. Detta är source of truth – hjälpsidan på webben kan vara inaktuell.

export const STANDARD_DAGAR = 30; // vanligt öppet köp
export const MEDLEM_DAGAR = 60; // Vävd-medlemmar får längre öppet köp ...
export const REA_DAGAR = 14; // ... men rea-plagg har alltid 14 dagar, även för medlemmar

// Av hygienskäl kan dessa aldrig returneras, oavsett om de är oanvända
export const EJ_RETURNERBARA_KATEGORIER = new Set(["underkläder", "badkläder"]);

export const RETURFRAKT_KR = 49; // dras från återbetalningen
export const RETURFRAKT_MEDLEM_KR = 0; // medlemmar returnerar gratis

export function returfristDagar(kategori: string, varRea: boolean, kundArMedlem: boolean): number {
  if (EJ_RETURNERBARA_KATEGORIER.has(kategori)) return 0;
  if (varRea) return REA_DAGAR;
  if (kundArMedlem) return MEDLEM_DAGAR;
  return STANDARD_DAGAR;
}

// Fristen räknas från LEVERANSDATUM, inte orderdatum.
export function kanReturneras(
  kategori: string,
  varRea: boolean,
  kundArMedlem: boolean,
  leveransdatum: Date,
  idag = new Date(),
): boolean {
  const dagarSedan = Math.floor((idag.getTime() - leveransdatum.getTime()) / 86_400_000);
  return dagarSedan <= returfristDagar(kategori, varRea, kundArMedlem);
}

export function returfrakt(kundArMedlem: boolean): number {
  return kundArMedlem ? RETURFRAKT_MEDLEM_KR : RETURFRAKT_KR;
}
