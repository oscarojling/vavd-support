import { SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  const svar = Response.json({ ok: true });
  svar.headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return svar;
}
