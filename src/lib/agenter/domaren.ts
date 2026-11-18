import { generateText, Output } from "ai";
import { z } from "zod";
import { lattModell } from "@/lib/agenter/modell";

const SYSTEM = `Du bedömer om ett supportsvar stämmer med facit.
Svaret är rätt om det innehåller det väsentliga i facit och inte säger emot det.
Formuleringar får skilja sig. Extra korrekt information är ok, men påhittade regler,
löften eller uppgifter som facit säger att svaret inte får ha gör svaret fel.
Om facit säger att svaret ska vara på ett visst språk, eller inte får avslöja något, ska du kontrollera det.`;

const schema = z.object({
  ratt: z.boolean(),
  kommentar: z.string().describe("En mening om varför"),
});

export async function doma(fraga: string, facit: string, svar: string) {
  const { output } = await generateText({
    model: lattModell,
    system: SYSTEM,
    prompt: `Fråga:\n${fraga}\n\nFacit:\n${facit}\n\nSvar att bedöma:\n${svar}`,
    output: Output.object({ schema }),
  });
  return output;
}
