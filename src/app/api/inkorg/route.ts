import { z } from "zod";
import { kravInloggning } from "@/lib/auth";
import { driv, koa } from "@/lib/ko";
import { lasInkorgsrader, sparaMeddelande } from "@/lib/lagring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Varje hämtning av inkorgen startar också väntande jobb i bakgrunden (se lib/ko.ts).
export async function GET(): Promise<Response> {
  const anvandare = await kravInloggning();
  if (anvandare instanceof Response) return anvandare;

  await driv();
  return Response.json(await lasInkorgsrader());
}

const nyttMeddelande = z.object({
  kanal: z.enum(["mejl", "slack", "teams"]),
  fran: z.string().min(1).max(200),
  amne: z.string().max(200).optional(),
  text: z.string().min(1).max(5000),
});

// Nya meddelanden körs direkt. Hit kan du senare peka en mejl-webhook eller en Slack-bot.
export async function POST(req: Request): Promise<Response> {
  const anvandare = await kravInloggning();
  if (anvandare instanceof Response) return anvandare;

  const tolkat = nyttMeddelande.safeParse(await req.json().catch(() => null));
  if (!tolkat.success) return Response.json({ fel: "Ogiltigt meddelande" }, { status: 400 });
  const meddelande = await sparaMeddelande(tolkat.data);
  await koa([meddelande.id]);
  await driv();
  return Response.json(meddelande, { status: 201 });
}
