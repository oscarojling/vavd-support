// Sätter upp databasen.
//
//   npm run db:setup        skapar tabellerna, fyller butiksdatan och läser in inkorg/*.json
//                           (befintliga ärenden och meddelanden lämnas orörda)
//   npm run db:aterstall    nollställer inför en demo: tar bort alla svar, testkörningar och
//                           meddelanden som skickats in via appen, och fyller butiksdatan på
//                           nytt med datum räknade från idag
//
// Läser DATABASE_URL från .env.local om den finns.
import postgres from "postgres";
import { existsSync, readdirSync, readFileSync } from "node:fs";

if (existsSync(".env.local")) {
  for (const rad of readFileSync(".env.local", "utf-8").split("\n")) {
    const m = rad.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) {
  console.error("DATABASE_URL saknas. Kopiera den från Vercel (Storage → din databas → .env.local) till .env.local.");
  process.exit(1);
}

const aterstall = process.argv.includes("--aterstall");
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

const dag = (dagarSedan) => {
  const d = new Date();
  d.setDate(d.getDate() - dagarSedan);
  return d.toISOString().slice(0, 10);
};

try {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS meddelanden (
      id text PRIMARY KEY,
      kanal text NOT NULL,
      fran text NOT NULL,
      amne text,
      text text NOT NULL,
      fran_fil boolean NOT NULL DEFAULT false,
      ko text,
      ko_startad timestamptz,
      logg jsonb NOT NULL DEFAULT '[]',
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS arenden (
      id text PRIMARY KEY REFERENCES meddelanden(id) ON DELETE CASCADE,
      data jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS testkorningar (
      id text PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS testrader (
      korning_id text NOT NULL REFERENCES testkorningar(id) ON DELETE CASCADE,
      id text NOT NULL,
      fraga text NOT NULL,
      facit text NOT NULL,
      status text NOT NULL DEFAULT 'vantar',
      startad timestamptz,
      svar text NOT NULL DEFAULT '',
      fakta text NOT NULL DEFAULT '',
      ratt boolean,
      kommentar text NOT NULL DEFAULT '',
      PRIMARY KEY (korning_id, id)
    );

    CREATE SCHEMA IF NOT EXISTS butik;
    CREATE TABLE IF NOT EXISTS butik.kunder (id integer PRIMARY KEY, namn text, epost text UNIQUE, medlem boolean);
    CREATE TABLE IF NOT EXISTS butik.ordrar (id integer PRIMARY KEY, kund_id integer, orderdatum date, leveransdatum date,
                                             status text, land text, fraktkostnad integer, sparningsnummer text);
    CREATE TABLE IF NOT EXISTS butik.orderrader (order_id integer, produkt text, kategori text, storlek text, pris integer, var_rea boolean);
    CREATE TABLE IF NOT EXISTS butik.rabattkoder (kod text PRIMARY KEY, procent integer, kategori text, giltig_till date, min_belopp integer);
    CREATE TABLE IF NOT EXISTS butik.anvanda_koder (kod text, kund_id integer, datum date);
  `);

  if (aterstall) {
    await sql`DELETE FROM testkorningar`;
    await sql`DELETE FROM meddelanden WHERE NOT fran_fil`;
    await sql`DELETE FROM arenden`;
    await sql`UPDATE meddelanden SET ko = NULL, ko_startad = NULL, logg = '[]'`;
    await sql.unsafe(`TRUNCATE butik.kunder, butik.ordrar, butik.orderrader, butik.rabattkoder, butik.anvanda_koder`);
  }

  const [{ antal }] = await sql`SELECT count(*)::int AS antal FROM butik.kunder`;
  if (antal === 0) {
    await sql.begin(async (tx) => {
      await tx`INSERT INTO butik.kunder ${tx([
        { id: 1, namn: "Sara Lind", epost: "sara.lind@example.com", medlem: false },
        { id: 2, namn: "Erik Holm", epost: "erik.holm@example.com", medlem: true },
        { id: 3, namn: "Amina Yusuf", epost: "amina.yusuf@example.com", medlem: false },
        { id: 4, namn: "Johan Berg", epost: "johan.berg@example.com", medlem: true },
        { id: 5, namn: "Kari Nordmann", epost: "kari.nordmann@example.no", medlem: false },
      ])}`;
      const order = (id, kund_id, orderdatum, leveransdatum, status, land, fraktkostnad, sparningsnummer) =>
        ({ id, kund_id, orderdatum, leveransdatum, status, land, fraktkostnad, sparningsnummer });
      await tx`INSERT INTO butik.ordrar ${tx([
        order(10231, 1, dag(12), dag(10), "levererad", "Sverige", 59, "PN-55120231"),
        order(10234, 2, dag(4), null, "skickad", "Sverige", 0, "PN-55120234"),
        order(10240, 3, dag(1), null, "behandlas", "Sverige", 0, null),
        order(10242, 4, dag(22), dag(20), "levererad", "Sverige", 0, "PN-55120242"),
        order(10245, 5, dag(6), null, "skickad", "Norge", 129, "PN-55120245"),
      ])}`;
      const rad = (order_id, produkt, kategori, storlek, pris, var_rea) => ({ order_id, produkt, kategori, storlek, pris, var_rea });
      await tx`INSERT INTO butik.orderrader ${tx([
        rad(10231, "Ö bikini", "badkläder", "M", 299, true),
        rad(10231, "Bas t-shirt", "överdelar", "M", 199, false),
        rad(10234, "Fjällgren jacka", "jackor", "L", 1899, false),
        rad(10240, "Lina jeans", "byxor", "30", 799, false),
        rad(10242, "Lina jeans", "byxor", "28", 479, true),
        rad(10245, "Fjällgren jacka", "jackor", "M", 1899, false),
        rad(10245, "Bas t-shirt", "överdelar", "S", 199, false),
      ])}`;
      await tx`INSERT INTO butik.rabattkoder ${tx([
        { kod: "HOST20", procent: 20, kategori: "jackor", giltig_till: dag(-20), min_belopp: 500 },
        { kod: "SOMMAR15", procent: 15, kategori: null, giltig_till: dag(60), min_belopp: 0 },
        { kod: "VALKOMMEN10", procent: 10, kategori: null, giltig_till: dag(-365), min_belopp: 300 },
      ])}`;
      await tx`INSERT INTO butik.anvanda_koder ${tx([{ kod: "VALKOMMEN10", kund_id: 3, datum: dag(30) }])}`;
    });
    console.log("Fyllde butiksdatan (kunder, ordrar, rabattkoder).");
  }

  const filer = readdirSync("inkorg").filter((f) => f.endsWith(".json")).sort();
  let nya = 0;
  for (const fil of filer) {
    const m = JSON.parse(readFileSync(`inkorg/${fil}`, "utf-8"));
    const [rad] = await sql`
      INSERT INTO meddelanden (id, kanal, fran, amne, text, fran_fil)
      VALUES (${m.id}, ${m.kanal}, ${m.fran}, ${m.amne ?? null}, ${m.text}, true)
      ON CONFLICT (id) DO NOTHING RETURNING id`;
    if (rad) nya++;
  }
  console.log(`Inkorgen: ${nya} nya meddelanden inlästa (${filer.length} filer).`);

  // Flytta in svar och egna meddelanden från den gamla filbaserade versionen, om de finns.
  if (!aterstall && existsSync("data/arenden")) {
    let flyttade = 0;
    for (const fil of readdirSync("data/arenden").filter((f) => f.endsWith(".json"))) {
      const a = JSON.parse(readFileSync(`data/arenden/${fil}`, "utf-8"));
      const m = a.meddelande;
      await sql`INSERT INTO meddelanden (id, kanal, fran, amne, text)
                VALUES (${m.id}, ${m.kanal}, ${m.fran}, ${m.amne ?? null}, ${m.text}) ON CONFLICT (id) DO NOTHING`;
      const [rad] = await sql`INSERT INTO arenden (id, data) VALUES (${m.id}, ${sql.json(a)})
                              ON CONFLICT (id) DO NOTHING RETURNING id`;
      if (rad) flyttade++;
    }
    if (flyttade) console.log(`Flyttade in ${flyttade} sparade svar från data/arenden.`);
  }
  console.log(aterstall ? "Återställt och klart." : "Databasen är klar.");
} finally {
  await sql.end();
}
