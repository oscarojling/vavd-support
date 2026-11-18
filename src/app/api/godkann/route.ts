import { kravInloggning } from "@/lib/auth";
import { z } from "zod";
import { lasArende, sparaArende } from "@/lib/lagring";

export const runtime = "nodejs";

const beslut = z.object({
  id: z.string(),
  beslut: z.enum(["skicka", "avvisa"]),
  svar: z.string().optional(),
});

// Människans steg. "Skicka" är simulerat – här kopplar du senare in riktig mejlutskick.
export async function POST(req: Request): Promise<Response> {
  const anvandare = await kravInloggning();
  if (anvandare instanceof Response) return anvandare;

  const tolkat = beslut.safeParse(await req.json());
  if (!tolkat.success) return Response.json({ fel: "Ogiltigt beslut" }, { status: 400 });

  const arende = await lasArende(tolkat.data.id);
  if (!arende) return Response.json({ fel: "Ärendet finns inte" }, { status: 404 });

  arende.svar = tolkat.data.svar ?? arende.svar;
  arende.status = tolkat.data.beslut === "skicka" ? "skickat" : "avvisat";
  arende.beslutAv = anvandare;
  arende.uppdaterad = new Date().toISOString();
  await sparaArende(arende);
  return Response.json(arende);
}
