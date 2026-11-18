import { kravInloggning } from "@/lib/auth";
import { drivTest, senasteTest, startaTest, testbaraMeddelanden } from "@/lib/test";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Testvyn hämtar det här varannan sekund medan ett test pågår; varje hämtning startar
// nästa väntande fråga i bakgrunden.
export async function GET(): Promise<Response> {
  const anvandare = await kravInloggning();
  if (anvandare instanceof Response) return anvandare;

  await drivTest();
  return Response.json({ senaste: await senasteTest(), antalMedFacit: (await testbaraMeddelanden()).length });
}

export async function POST(req: Request): Promise<Response> {
  const anvandare = await kravInloggning();
  if (anvandare instanceof Response) return anvandare;

  const { baraFel } = (await req.json().catch(() => ({}))) as { baraFel?: boolean };
  let bara: string[] | undefined;
  if (baraFel) {
    const senaste = await senasteTest();
    bara = senaste?.rader.filter((r) => r.ratt !== true).map((r) => r.id);
    if (!bara?.length) return Response.json({ fel: "Inga felaktiga svar att testa om" }, { status: 400 });
  }
  await startaTest(bara);
  return Response.json(await senasteTest(), { status: 202 });
}
