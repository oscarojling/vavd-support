// Skapar den påhittade databasen data/butik.db.
// Datum räknas relativt dagens datum, så att exemplen fungerar oavsett när du kör.
// Kör:  npm run seed
import Database from "better-sqlite3";
import { mkdirSync, rmSync } from "node:fs";

mkdirSync("data", { recursive: true });
rmSync("data/butik.db", { force: true });
const db = new Database("data/butik.db");

const dag = (dagarSedan) => {
  const d = new Date();
  d.setDate(d.getDate() - dagarSedan);
  return d.toISOString().slice(0, 10);
};

db.exec(`
  CREATE TABLE kunder (id INTEGER PRIMARY KEY, namn TEXT, epost TEXT UNIQUE, medlem INTEGER);
  CREATE TABLE ordrar (id INTEGER PRIMARY KEY, kund_id INTEGER, orderdatum TEXT, leveransdatum TEXT,
                       status TEXT, land TEXT, fraktkostnad INTEGER, sparningsnummer TEXT);
  CREATE TABLE orderrader (order_id INTEGER, produkt TEXT, kategori TEXT, storlek TEXT, pris INTEGER, var_rea INTEGER);
  CREATE TABLE rabattkoder (kod TEXT PRIMARY KEY, procent INTEGER, kategori TEXT, giltig_till TEXT, min_belopp INTEGER);
  CREATE TABLE anvanda_koder (kod TEXT, kund_id INTEGER, datum TEXT);
`);

const infoga = (tabell, rader) => {
  const platshallare = rader[0].map(() => "?").join(",");
  const stmt = db.prepare(`INSERT INTO ${tabell} VALUES (${platshallare})`);
  for (const r of rader) stmt.run(r);
};

infoga("kunder", [
  [1, "Sara Lind", "sara.lind@example.com", 0],
  [2, "Erik Holm", "erik.holm@example.com", 1],
  [3, "Amina Yusuf", "amina.yusuf@example.com", 0],
  [4, "Johan Berg", "johan.berg@example.com", 1],
  [5, "Kari Nordmann", "kari.nordmann@example.no", 0],
]);
infoga("ordrar", [
  [10231, 1, dag(12), dag(10), "levererad", "Sverige", 59, "PN-55120231"],
  [10234, 2, dag(4), null, "skickad", "Sverige", 0, "PN-55120234"],
  [10240, 3, dag(1), null, "behandlas", "Sverige", 0, null],
  [10242, 4, dag(22), dag(20), "levererad", "Sverige", 0, "PN-55120242"],
  [10245, 5, dag(6), null, "skickad", "Norge", 129, "PN-55120245"],
]);
infoga("orderrader", [
  [10231, "Ö bikini", "badkläder", "M", 299, 1],
  [10231, "Bas t-shirt", "överdelar", "M", 199, 0],
  [10234, "Fjällgren jacka", "jackor", "L", 1899, 0],
  [10240, "Lina jeans", "byxor", "30", 799, 0],
  [10242, "Lina jeans", "byxor", "28", 479, 1],
  [10245, "Fjällgren jacka", "jackor", "M", 1899, 0],
  [10245, "Bas t-shirt", "överdelar", "S", 199, 0],
]);
infoga("rabattkoder", [
  ["HOST20", 20, "jackor", dag(-20), 500],
  ["SOMMAR15", 15, null, dag(60), 0],
  ["VALKOMMEN10", 10, null, dag(-365), 300],
]);
infoga("anvanda_koder", [["VALKOMMEN10", 3, dag(30)]]);

db.close();
console.log("Skapade data/butik.db");
