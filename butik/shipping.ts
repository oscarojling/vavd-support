// Fraktregler för Vävd.

export const FRI_FRAKT_GRANS_KR = 499; // gäller ENDAST leveranser inom Sverige
export const FRAKT_SVERIGE_KR = 59;
export const FRAKT_NORDEN_KR = 129; // Norge, Danmark, Finland – aldrig fri frakt
export const EXPRESS_KR = 99; // endast Sverige, ej lördag/söndag

export const SISTA_ORDERTID_TIMME = 14; // beställt före 14:00 en vardag skickas samma dag

export const LEVERANSTID_VARDAGAR: Record<string, [number, number]> = {
  Sverige: [1, 3],
  Norge: [3, 6], // tullhantering kan ge extra dagar
  Danmark: [2, 4],
  Finland: [2, 5],
};

export function fraktkostnad(land: string, ordervardeKr: number, express = false): number {
  if (land === "Sverige") {
    if (express) return EXPRESS_KR;
    return ordervardeKr >= FRI_FRAKT_GRANS_KR ? 0 : FRAKT_SVERIGE_KR;
  }
  return FRAKT_NORDEN_KR;
}

export function skickasSammaDag(bestalld: Date): boolean {
  const dag = bestalld.getDay();
  const arVardag = dag >= 1 && dag <= 5;
  return arVardag && bestalld.getHours() < SISTA_ORDERTID_TIMME;
}
