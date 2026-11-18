import { hantera } from "./agenter/flode";
import { iBakgrunden } from "./bakgrund";
import { db } from "./db";
import { hittaMeddelande, JOBB_MAX_MINUTER } from "./lagring";
import type { Handelse } from "./typer";

// Kön ligger i databasen (kolumnen meddelanden.ko), så den fungerar även när Vercel
// kör varje anrop i en ny instans. Varje gång inkorgen hämtas, eller ett meddelande
// läggs i kön, startas upp till SAMTIDIGA väntande jobb i bakgrunden.
const SAMTIDIGA = 2;

export async function koa(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db()`
    UPDATE meddelanden SET ko = 'i_ko', ko_startad = NULL, logg = '[]'
    WHERE id IN ${db()(ids)}
      AND (ko IS NULL OR (ko = 'arbetar' AND ko_startad < now() - make_interval(mins => ${JOBB_MAX_MINUTER})))`;
}

export async function driv(): Promise<void> {
  const sql = db();
  await sql`
    UPDATE meddelanden
    SET ko = NULL, logg = logg || ${sql.json([{ typ: "fel", text: "Körningen avbröts innan den blev klar. Kör om." }])}
    WHERE ko = 'arbetar' AND ko_startad < now() - make_interval(mins => ${JOBB_MAX_MINUTER})`;

  const [{ arbetar }] = await sql<{ arbetar: number }[]>`
    SELECT count(*)::int AS arbetar FROM meddelanden WHERE ko = 'arbetar'`;
  const lediga = SAMTIDIGA - arbetar;
  if (lediga <= 0) return;

  const tagna = await sql<{ id: string }[]>`
    UPDATE meddelanden SET ko = 'arbetar', ko_startad = now()
    WHERE id IN (
      SELECT id FROM meddelanden WHERE ko = 'i_ko' ORDER BY id LIMIT ${lediga} FOR UPDATE SKIP LOCKED
    )
    RETURNING id`;
  for (const { id } of tagna) iBakgrunden(() => kor(id));
}

async function kor(id: string): Promise<void> {
  const sql = db();
  let kedja = Promise.resolve();
  const logga = (h: Handelse) => {
    kedja = kedja.then(async () => {
      await sql`UPDATE meddelanden SET logg = logg || ${sql.json([h])} WHERE id = ${id}`;
    });
  };
  try {
    const meddelande = await hittaMeddelande(id);
    if (!meddelande) throw new Error("Meddelandet finns inte längre");
    await hantera(meddelande, logga);
  } catch (fel) {
    logga({ typ: "fel", text: (fel as Error).message });
  } finally {
    await kedja.catch(() => {});
    await sql`UPDATE meddelanden SET ko = NULL, ko_startad = NULL WHERE id = ${id}`;
  }
}
