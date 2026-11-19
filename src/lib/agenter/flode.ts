import { sparaArende } from "../lagring";
import type { Arende, Bedomning, Handelse, Meddelande, Sortering } from "../typer";
import { granska } from "./granskaren";
import { skriv } from "./skribenten";
import { sortera } from "./sorteraren";
import { utred } from "./utredaren";

const MAX_FORSOK = 2;

// Kundsvar i dessa kategorier skickas utan ditt godkännande, om Granskaren godkänt dem
// och bedömt att de är säkra att skicka automatiskt. Returer, rabatter m.m. godkänner du
// alltid själv.
const AUTOSKICKA_KUNDKATEGORIER: Sortering["kategori"][] = ["orderstatus"];

export async function hantera(
  m: Meddelande,
  skicka: (h: Handelse) => void,
  { spara = true }: { spara?: boolean } = {},
): Promise<Arende> {
  const sortering = await sortera(m);
  skicka({
    typ: "steg",
    agent: "Sorteraren",
    text: `${sortering.avsandare} · ${sortering.kategori}${sortering.bradskande ? " · brådskande" : ""}`,
    detalj: sortering.sammanfattning,
  });

  const logga = (namn: string, indata: string) => skicka({ typ: "verktyg", namn, indata });
  let aterkoppling: string | null = null;
  let fakta = "";
  let svar = "";
  let bedomning: Bedomning | null = null;
  let forsok = 0;

  while (forsok < MAX_FORSOK) {
    forsok++;
    if (forsok === 1 || bedomning?.felHos === "utredaren") {
      fakta = await utred(m, sortering, aterkoppling, logga);
      skicka({ typ: "steg", agent: "Utredaren", text: `Fakta hämtade (försök ${forsok})`, detalj: fakta });
    }
    svar = await skriv(m, sortering, fakta, aterkoppling);
    skicka({ typ: "steg", agent: "Skribenten", text: `Utkast klart (försök ${forsok})`, detalj: svar });

    bedomning = await granska(m, sortering, fakta, svar);
    if (bedomning.godkand) {
      const auto = sortering.avsandare === "kund" && AUTOSKICKA_KUNDKATEGORIER.includes(sortering.kategori);
      skicka({
        typ: "steg",
        agent: "Granskaren",
        text: auto ? (bedomning.sakerAttSkicka ? "Godkänt – säkert att skicka automatiskt" : "Godkänt – men en människa bör läsa först") : "Godkänt",
        detalj: auto ? bedomning.motivering : undefined,
      });
      break;
    }
    aterkoppling = bedomning.aterkoppling;
    skicka({ typ: "steg", agent: "Granskaren", text: `Underkänt – fel hos ${bedomning.felHos}`, detalj: aterkoppling });
  }

  const arende: Arende = {
    meddelande: m,
    sortering,
    fakta,
    svar,
    bedomning: bedomning!,
    forsok,
    status: "att_godkanna",
    autoskickat: false,
    uppdaterad: new Date().toISOString(),
  };

  if (!bedomning!.godkand) {
    arende.status = "behover_manniska";
  } else if (sortering.avsandare === "personal") {
    arende.status = "skickat";
  } else if (AUTOSKICKA_KUNDKATEGORIER.includes(sortering.kategori) && bedomning!.sakerAttSkicka) {
    arende.status = "skickat";
    arende.autoskickat = true;
  }
  if (spara) await sparaArende(arende);
  return arende;
}
