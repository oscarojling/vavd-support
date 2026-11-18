import { generateText, Output } from "ai";
import { z } from "zod";
import type { Meddelande, Sortering } from "../typer";
import { lattModell } from "@/lib/agenter/modell";

const SYSTEM = `Du är Sorteraren i kundservice för klädbutiken Vävd.
Du får ett inkommet meddelande. Din enda uppgift är att sortera det, inte att svara.
Avgör vad det gäller, plocka ut ordernummer om det finns, och sammanfatta frågan
i en mening så att nästa agent vet exakt vad som ska utredas.`;

const schema = z.object({
  kategori: z.enum(["retur", "frakt", "rabattkod", "storlek", "orderstatus", "övrigt"]),
  ordernummer: z.string().nullable(),
  sammanfattning: z.string().describe("Frågan i en mening"),
  bradskande: z.boolean().describe("Sant om t.ex. en kund väntar i kassan"),
});

export async function sortera(m: Meddelande): Promise<Sortering> {
  // Vem som frågar avgörs av kanalen, inte av AI:n – det är säkrare.
  const avsandare = m.kanal === "mejl" ? "kund" : "personal";
  const { output } = await generateText({
    model: lattModell,
    system: SYSTEM,
    prompt: `Kanal: ${m.kanal}\nFrån: ${m.fran}\nÄmne: ${m.amne ?? ""}\n\n${m.text}`,
    output: Output.object({ schema }),
  });
  return { ...output, avsandare };
}
