import { kravInloggning } from "@/lib/auth";
import { koa } from "@/lib/ko";
import { hittaMeddelande, lasArende, lasInkorg } from "@/lib/lagring";

export const runtime = "nodejs";

// Lägger ett meddelande i kön igen ("Kör om"), eller alla som aldrig körts.
export async function POST(req: Request): Promise<Response> {
  const anvandare = await kravInloggning();
  if (anvandare instanceof Response) return anvandare;

  const { id, allaVantande } = (await req.json()) as { id?: string; allaVantande?: boolean };

  if (allaVantande) {
    const vantande = lasInkorg().filter((m) => !lasArende(m.id));
    vantande.forEach((m) => koa(m.id));
    return Response.json({ koade: vantande.length }, { status: 202 });
  }

  if (!id || !hittaMeddelande(id)) return Response.json({ fel: "Meddelandet finns inte" }, { status: 404 });
  koa(id);
  return Response.json({ koade: 1 }, { status: 202 });
}
