import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Arende, Meddelande } from "./typer";

const ROT = process.cwd();
const INKORG = path.join(ROT, "inkorg");
const ARENDEN = path.join(ROT, "data", "arenden");

export function lasInkorg(): Meddelande[] {
  return readdirSync(INKORG)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(path.join(INKORG, f), "utf-8")) as Meddelande);
}

export function hittaMeddelande(id: string): Meddelande | undefined {
  return lasInkorg().find((m) => m.id === id);
}

export function sparaMeddelande(m: Omit<Meddelande, "id">): Meddelande {
  const nummer = String(lasInkorg().length + 1).padStart(2, "0");
  const nytt: Meddelande = { ...m, id: `${nummer}_${m.kanal}_${Date.now().toString(36)}` };
  writeFileSync(path.join(INKORG, `${nytt.id}.json`), JSON.stringify(nytt, null, 2));
  return nytt;
}

export function lasArende(id: string): Arende | null {
  const fil = path.join(ARENDEN, `${id}.json`);
  return existsSync(fil) ? (JSON.parse(readFileSync(fil, "utf-8")) as Arende) : null;
}

export function sparaArende(arende: Arende): void {
  mkdirSync(ARENDEN, { recursive: true });
  writeFileSync(path.join(ARENDEN, `${arende.meddelande.id}.json`), JSON.stringify(arende, null, 2));
}
