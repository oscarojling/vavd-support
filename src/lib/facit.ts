import { readFileSync } from "node:fs";
import path from "node:path";

// Läser FACIT.md. Varje tabellrad som börjar med ett nummer, t.ex.
// "| 05 Slack | Nej. Rea-plagg ... | returns.ts |", kopplas till meddelandet
// vars id börjar med samma nummer (05_slack_rea_retur).
export function lasFacit(): Map<string, string> {
  const facit = new Map<string, string>();
  const text = readFileSync(path.join(process.cwd(), "FACIT.md"), "utf-8");
  for (const rad of text.split("\n")) {
    const traff = rad.match(/^\|\s*(\d+)\b[^|]*\|([^|]+)\|/);
    if (traff) facit.set(traff[1].padStart(2, "0"), traff[2].trim());
  }
  return facit;
}

export function facitFor(id: string, facit: Map<string, string>): string | undefined {
  const nummer = id.match(/^\d+/)?.[0];
  return nummer ? facit.get(nummer.padStart(2, "0")) : undefined;
}
