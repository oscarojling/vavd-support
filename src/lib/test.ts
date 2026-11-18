import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { doma } from "./agenter/domaren";
import { hantera } from "./agenter/flode";
import { facitFor, lasFacit } from "./facit";
import { lasInkorg } from "./lagring";
import type { Meddelande, Testkorning, Testrad } from "./typer";

const MAPP = path.join(process.cwd(), "data", "tester");
const SAMTIDIGA = 2;

const g = globalThis as unknown as { __vavdTest?: Testkorning | null };

export function senasteTest(): Testkorning | null {
  if (g.__vavdTest) return g.__vavdTest;
  try {
    const filer = readdirSync(MAPP).filter((f) => f.endsWith(".json")).sort();
    if (filer.length === 0) return null;
    return JSON.parse(readFileSync(path.join(MAPP, filer.at(-1)!), "utf-8")) as Testkorning;
  } catch {
    return null;
  }
}

export function testbaraMeddelanden(bara?: string[]): { meddelande: Meddelande; facit: string }[] {
  const facit = lasFacit();
  return lasInkorg()
    .map((meddelande) => ({ meddelande, facit: facitFor(meddelande.id, facit) }))
    .filter((r): r is { meddelande: Meddelande; facit: string } => !!r.facit)
    .filter((r) => !bara || bara.includes(r.meddelande.id));
}

export function startaTest(bara?: string[]): Testkorning {
  const pagaende = g.__vavdTest;
  if (pagaende && !pagaende.klar) return pagaende;

  const lista = testbaraMeddelanden(bara);
  const korning: Testkorning = {
    startad: new Date().toISOString(),
    klar: false,
    antal: lista.length,
    rader: [],
  };
  g.__vavdTest = korning;

  const kvar = [...lista];
  const arbetare = Array.from({ length: SAMTIDIGA }, async () => {
    for (let nasta = kvar.shift(); nasta; nasta = kvar.shift()) {
      korning.rader.push(await testaEtt(nasta.meddelande, nasta.facit));
    }
  });

  Promise.all(arbetare).finally(() => {
    korning.rader.sort((a, b) => a.id.localeCompare(b.id));
    korning.klar = true;
    mkdirSync(MAPP, { recursive: true });
    writeFileSync(path.join(MAPP, `${korning.startad.replace(/[:.]/g, "-")}.json`), JSON.stringify(korning, null, 2));
  });

  return korning;
}

async function testaEtt(m: Meddelande, facit: string): Promise<Testrad> {
  const rad: Testrad = { id: m.id, fraga: m.text, facit, svar: "", fakta: "", ratt: null, kommentar: "" };
  try {
    const arende = await hantera(m, () => {}, { spara: false });
    rad.svar = arende.svar;
    rad.fakta = arende.fakta;
    const dom = await doma(m.text, facit, arende.svar);
    rad.ratt = dom.ratt;
    rad.kommentar = dom.kommentar;
  } catch (fel) {
    rad.kommentar = `Fel under körningen: ${(fel as Error).message}`;
  }
  return rad;
}
