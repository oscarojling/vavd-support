import { db } from "./db";
import type { Arende, Handelse, Inkorgsrad, Kostatus, Meddelande } from "./typer";

// Ett jobb som "arbetar" längre än så här räknas som avbrutet (t.ex. om Vercel
// stoppade funktionen) och kan köras igen.
export const JOBB_MAX_MINUTER = 6;

type MeddelandeRad = Meddelande & { ko: string | null; ko_startad: Date | null; logg: Handelse[] };

function tillMeddelande(r: MeddelandeRad): Meddelande {
  return { id: r.id, kanal: r.kanal, fran: r.fran, amne: r.amne ?? undefined, text: r.text };
}

export function kostatusFor(r: { ko: string | null; ko_startad: Date | null }): Kostatus {
  if (r.ko === "i_ko") return "i_ko";
  if (r.ko === "arbetar" && r.ko_startad && Date.now() - r.ko_startad.getTime() < JOBB_MAX_MINUTER * 60_000) {
    return "arbetar";
  }
  return null;
}

export async function lasInkorgsrader(): Promise<Inkorgsrad[]> {
  const rader = await db()<(MeddelandeRad & { arende: Arende | null })[]>`
    SELECT m.*, a.data AS arende
    FROM meddelanden m LEFT JOIN arenden a ON a.id = m.id
    ORDER BY m.id`;
  return rader.map((r) => ({
    meddelande: tillMeddelande(r),
    arende: r.arende,
    ko: kostatusFor(r),
    logg: r.logg ?? [],
  }));
}

export async function hittaMeddelande(id: string): Promise<Meddelande | undefined> {
  const [r] = await db()<MeddelandeRad[]>`SELECT * FROM meddelanden WHERE id = ${id}`;
  return r ? tillMeddelande(r) : undefined;
}

export async function sparaMeddelande(m: Omit<Meddelande, "id">): Promise<Meddelande> {
  const [{ antal }] = await db()<{ antal: number }[]>`SELECT count(*)::int AS antal FROM meddelanden`;
  const nummer = String(antal + 1).padStart(2, "0");
  const nytt: Meddelande = { ...m, id: `${nummer}_${m.kanal}_${Date.now().toString(36)}` };
  await db()`INSERT INTO meddelanden (id, kanal, fran, amne, text)
             VALUES (${nytt.id}, ${nytt.kanal}, ${nytt.fran}, ${nytt.amne ?? null}, ${nytt.text})`;
  return nytt;
}

export async function lasArende(id: string): Promise<Arende | null> {
  const [r] = await db()<{ data: Arende }[]>`SELECT data FROM arenden WHERE id = ${id}`;
  return r?.data ?? null;
}

export async function sparaArende(arende: Arende): Promise<void> {
  const data = db().json(arende as unknown as Parameters<ReturnType<typeof db>["json"]>[0]);
  await db()`INSERT INTO arenden (id, data) VALUES (${arende.meddelande.id}, ${data})
             ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`;
}
