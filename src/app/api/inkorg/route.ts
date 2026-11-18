import { kravInloggning } from "@/lib/auth";
import { z } from "zod";
import { koa, kostatus, logg, markeraKand, upptackNya } from "@/lib/ko";
import { lasArende, lasInkorg, sparaMeddelande } from "@/lib/lagring";
import type { Inkorgsrad } from "@/lib/typer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const anvandare = await kravInloggning();
  if (anvandare instanceof Response) return anvandare;

  const inkorg = lasInkorg();
  upptackNya(inkorg.map((m) => m.id));
  const rader: Inkorgsrad[] = inkorg.map((meddelande) => ({
    meddelande,
    arende: lasArende(meddelande.id),
    ko: kostatus(meddelande.id),
    logg: logg(meddelande.id),
  }));
  return Response.json(rader);
}

const nyttMeddelande = z.object({
  kanal: z.enum(["mejl", "slack", "teams"]),
  fran: z.string().min(1),
  amne: z.string().optional(),
  text: z.string().min(1),
});

// Nya meddelanden körs direkt. Hit kan du senare peka en mejl-webhook eller en Slack-bot.
export async function POST(req: Request): Promise<Response> {
  const anvandare = await kravInloggning();
  if (anvandare instanceof Response) return anvandare;

  const tolkat = nyttMeddelande.safeParse(await req.json());
  if (!tolkat.success) return Response.json({ fel: "Ogiltigt meddelande" }, { status: 400 });
  const meddelande = sparaMeddelande(tolkat.data);
  markeraKand(meddelande.id);
  koa(meddelande.id);
  return Response.json(meddelande, { status: 201 });
}
