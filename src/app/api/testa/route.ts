import { kravInloggning } from "@/lib/auth";
import { senasteTest, startaTest, testbaraMeddelanden } from "@/lib/test";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const anvandare = await kravInloggning();
  if (anvandare instanceof Response) return anvandare;

  return Response.json({ senaste: senasteTest(), antalMedFacit: testbaraMeddelanden().length });
}

export async function POST(req: Request): Promise<Response> {
  const anvandare = await kravInloggning();
  if (anvandare instanceof Response) return anvandare;

  const { baraFel } = (await req.json().catch(() => ({}))) as { baraFel?: boolean };
  let bara: string[] | undefined;
  if (baraFel) {
    const senaste = senasteTest();
    bara = senaste?.rader.filter((r) => r.ratt !== true).map((r) => r.id);
    if (!bara?.length) return Response.json({ fel: "Inga felaktiga svar att testa om" }, { status: 400 });
  }
  return Response.json(startaTest(bara), { status: 202 });
}
