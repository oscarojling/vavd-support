import { randomUUID } from "node:crypto";
import { doma } from "./agenter/domaren";
import { hantera } from "./agenter/flode";
import { iBakgrunden } from "./bakgrund";
import { db } from "./db";
import { facitFor, lasFacit } from "./facit";
import { hittaMeddelande, JOBB_MAX_MINUTER, lasInkorgsrader } from "./lagring";
import type { Testkorning, Testrad } from "./typer";

// Testkörningen ligger i databasen. Varje fråga körs som ett eget bakgrundsjobb,
// två åt gången, så att ingen enskild funktion på Vercel behöver köra alla frågor.
const SAMTIDIGA = 2;

type Rad = Testrad & { status: string; startad: Date | null };

export async function testbaraMeddelanden(bara?: string[]) {
  const facit = lasFacit();
  return (await lasInkorgsrader())
    .map((r) => ({ meddelande: r.meddelande, facit: facitFor(r.meddelande.id, facit) }))
    .filter((r): r is { meddelande: typeof r.meddelande; facit: string } => !!r.facit)
    .filter((r) => !bara || bara.includes(r.meddelande.id));
}

async function senasteKorning(): Promise<{ id: string; created_at: Date } | undefined> {
  const [k] = await db()<{ id: string; created_at: Date }[]>`
    SELECT id, created_at FROM testkorningar ORDER BY created_at DESC LIMIT 1`;
  return k;
}

export async function senasteTest(): Promise<Testkorning | null> {
  const korning = await senasteKorning();
  if (!korning) return null;
  const rader = await db()<Rad[]>`SELECT * FROM testrader WHERE korning_id = ${korning.id} ORDER BY id`;
  const klara = rader.filter((r) => r.status === "klar");
  return {
    startad: korning.created_at.toISOString(),
    klar: klara.length === rader.length,
    antal: rader.length,
    rader: klara.map(({ id, fraga, facit, svar, fakta, ratt, kommentar }) => ({ id, fraga, facit, svar, fakta, ratt, kommentar })),
  };
}

export async function startaTest(bara?: string[]): Promise<void> {
  const pagaende = await senasteTest();
  if (pagaende && !pagaende.klar) return;

  const lista = await testbaraMeddelanden(bara);
  if (lista.length === 0) return;
  const id = randomUUID();
  await db().begin(async (tx) => {
    await tx`INSERT INTO testkorningar (id) VALUES (${id})`;
    await tx`INSERT INTO testrader ${tx(
      lista.map((r) => ({ korning_id: id, id: r.meddelande.id, fraga: r.meddelande.text, facit: r.facit })),
    )}`;
  });
  await drivTest();
}

export async function drivTest(): Promise<void> {
  const korning = await senasteKorning();
  if (!korning) return;
  const sql = db();

  await sql`
    UPDATE testrader SET status = 'klar', ratt = false, kommentar = 'Körningen avbröts innan den blev klar.'
    WHERE korning_id = ${korning.id} AND status = 'arbetar'
      AND startad < now() - make_interval(mins => ${JOBB_MAX_MINUTER})`;

  const [{ arbetar }] = await sql<{ arbetar: number }[]>`
    SELECT count(*)::int AS arbetar FROM testrader WHERE korning_id = ${korning.id} AND status = 'arbetar'`;
  const lediga = SAMTIDIGA - arbetar;
  if (lediga <= 0) return;

  const tagna = await sql<{ id: string; facit: string }[]>`
    UPDATE testrader SET status = 'arbetar', startad = now()
    WHERE korning_id = ${korning.id} AND id IN (
      SELECT id FROM testrader WHERE korning_id = ${korning.id} AND status = 'vantar'
      ORDER BY id LIMIT ${lediga} FOR UPDATE SKIP LOCKED
    )
    RETURNING id, facit`;
  for (const rad of tagna) iBakgrunden(() => testaEtt(korning.id, rad.id, rad.facit));
}

async function testaEtt(korningId: string, id: string, facit: string): Promise<void> {
  let resultat = { svar: "", fakta: "", ratt: false as boolean | null, kommentar: "" };
  try {
    const meddelande = await hittaMeddelande(id);
    if (!meddelande) throw new Error("Meddelandet finns inte längre");
    const arende = await hantera(meddelande, () => {}, { spara: false });
    const dom = await doma(meddelande.text, facit, arende.svar);
    resultat = { svar: arende.svar, fakta: arende.fakta, ratt: dom.ratt, kommentar: dom.kommentar };
  } catch (fel) {
    resultat.kommentar = `Fel under körningen: ${(fel as Error).message}`;
  }
  await db()`
    UPDATE testrader SET status = 'klar', svar = ${resultat.svar}, fakta = ${resultat.fakta},
      ratt = ${resultat.ratt}, kommentar = ${resultat.kommentar}
    WHERE korning_id = ${korningId} AND id = ${id}`;
  // Nästa fråga startas av nästa anrop till GET /api/testa (testvyn frågar varannan
  // sekund), så att ingen enskild funktion kör flera frågor efter varandra.
}
