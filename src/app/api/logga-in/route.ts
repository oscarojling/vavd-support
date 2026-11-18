import { z } from "zod";
import { kontrolleraLosenord, SESSION_COOKIE, SESSION_SEKUNDER, skapaSession } from "@/lib/auth";

export const runtime = "nodejs";

const inloggning = z.object({ namn: z.string().min(1).max(100), losenord: z.string().min(1).max(200) });

export async function POST(req: Request): Promise<Response> {
  const tolkat = inloggning.safeParse(await req.json().catch(() => null));
  if (!tolkat.success) return Response.json({ fel: "Fyll i namn och lösenord" }, { status: 400 });

  const namn = kontrolleraLosenord(tolkat.data.namn, tolkat.data.losenord);
  if (!namn) {
    await new Promise((r) => setTimeout(r, 500));
    return Response.json({ fel: "Fel namn eller lösenord" }, { status: 401 });
  }

  const svar = Response.json({ namn });
  const saker = process.env.NODE_ENV === "production" ? "; Secure" : "";
  svar.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${skapaSession(namn)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SEKUNDER}${saker}`,
  );
  return svar;
}
