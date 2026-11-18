import { hantera } from "./agenter/flode";
import { hittaMeddelande, lasArende } from "./lagring";
import type { Handelse, Kostatus } from "./typer";

// Kön som kör agenterna i bakgrunden. Ligger på globalThis så att den överlever
// omladdningar av koden i dev-läge.
const SAMTIDIGA = 2;

type Jobb = { logg: Handelse[]; klar: boolean };
type Kostate = {
  vantande: string[];
  jobb: Map<string, Jobb>;
  aktiva: number;
  kanda: Set<string> | null;
};

const g = globalThis as unknown as { __vavdKo?: Kostate };
const state: Kostate = (g.__vavdKo ??= { vantande: [], jobb: new Map(), aktiva: 0, kanda: null });

export function koa(id: string): void {
  const jobb = state.jobb.get(id);
  if (state.vantande.includes(id) || (jobb && !jobb.klar)) return;
  state.vantande.push(id);
  starta();
}

function starta(): void {
  while (state.aktiva < SAMTIDIGA && state.vantande.length > 0) {
    const id = state.vantande.shift()!;
    state.aktiva++;
    kor(id).finally(() => {
      state.aktiva--;
      starta();
    });
  }
}

async function kor(id: string): Promise<void> {
  const jobb: Jobb = { logg: [], klar: false };
  state.jobb.set(id, jobb);
  try {
    const meddelande = hittaMeddelande(id);
    if (!meddelande) throw new Error("Meddelandet finns inte längre");
    await hantera(meddelande, (h) => jobb.logg.push(h));
  } catch (fel) {
    jobb.logg.push({ typ: "fel", text: (fel as Error).message });
  } finally {
    jobb.klar = true;
  }
}

// Meddelanden som dyker upp i inkorg/ efter att servern startat (t.ex. från en
// mejl-webhook) körs automatiskt. De som redan låg där vid start körs bara när
// du ber om det, så att du inte förbrukar API-krediter av misstag.
export function upptackNya(ids: string[]): void {
  if (!state.kanda) {
    state.kanda = new Set(ids);
    return;
  }
  for (const id of ids) {
    if (state.kanda.has(id)) continue;
    state.kanda.add(id);
    if (!lasArende(id)) koa(id);
  }
}

export function markeraKand(id: string): void {
  state.kanda?.add(id);
}

export function kostatus(id: string): Kostatus {
  if (state.vantande.includes(id)) return "i_ko";
  const jobb = state.jobb.get(id);
  return jobb && !jobb.klar ? "arbetar" : null;
}

export function logg(id: string): Handelse[] {
  return state.jobb.get(id)?.logg ?? [];
}
