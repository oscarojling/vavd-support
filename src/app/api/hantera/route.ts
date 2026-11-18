import { kravInloggning } from "@/lib/auth";
import { driv, koa } from "@/lib/ko";
import { hittaMeddelande, lasInkorgsrader } from "@/lib/lagring";

export const runtime = "nodejs";
export const maxDuration = 300;

// Lägger ett meddelande i kön igen ("Kör om"), eller alla som aldrig körts.
export async function POST(req: Request): Promise<Response> {
  const anvandare = await kravInloggning();
  if (anvandare instanceof Response) return anvandare;

  const { id, allaVantande } = (await req.json().catch(() => ({}))) as { id?: string; allaVantande?: boolean };

  if (allaVantande) {
    const vantande = (await lasInkorgsrader()).filter((r) => !r.arende && !r.ko).map((r) => r.meddelande.id);
    await koa(vantande);
    await driv();
    return Response.json({ koade: vantande.length }, { status: 202 });
  }

  if (!id || !(await hittaMeddelande(id))) return Response.json({ fel: "Meddelandet finns inte" }, { status: 404 });
  await koa([id]);
  await driv();
  return Response.json({ koade: 1 }, { status: 202 });
}
