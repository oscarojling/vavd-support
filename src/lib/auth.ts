import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Enkel inloggning utan databas:
// - Användarna ligger i miljövariabeln ANVANDARE som "namn:salt:hash;namn2:salt:hash".
//   Skapa dem med  npm run anvandare -- <namn> <lösenord>
// - Sessionen är en signerad cookie (HMAC med AUTH_SECRET) som gäller i 7 dagar.

export const SESSION_COOKIE = "vavd_session";
export const SESSION_SEKUNDER = 60 * 60 * 24 * 7;

function hemlighet(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET saknas eller är för kort. Kör: npm run anvandare -- <namn> <lösenord>");
  return s;
}

function anvandare(): Map<string, { salt: string; hash: string }> {
  const lista = new Map<string, { salt: string; hash: string }>();
  for (const post of (process.env.ANVANDARE ?? "").split(";")) {
    const [namn, salt, hash] = post.trim().split(":");
    if (namn && salt && hash) lista.set(namn.toLowerCase(), { salt, hash });
  }
  return lista;
}

export function hashaLosenord(losenord: string, salt = randomBytes(16).toString("hex")): string {
  return `${salt}:${scryptSync(losenord, salt, 32).toString("hex")}`;
}

export function kontrolleraLosenord(namn: string, losenord: string): string | null {
  const post = anvandare().get(namn.trim().toLowerCase());
  // Räkna ut en hash även för okända namn, så att svarstiden inte avslöjar vilka namn som finns.
  const [, forvantad] = hashaLosenord(losenord, post?.salt ?? "0".repeat(32)).split(":");
  if (!post) return null;
  const ok = timingSafeEqual(Buffer.from(forvantad, "hex"), Buffer.from(post.hash, "hex"));
  return ok ? namn.trim().toLowerCase() : null;
}

function signera(data: string): string {
  return createHmac("sha256", hemlighet()).update(data).digest("base64url");
}

export function skapaSession(namn: string): string {
  const data = Buffer.from(JSON.stringify({ namn, exp: Date.now() + SESSION_SEKUNDER * 1000 })).toString("base64url");
  return `${data}.${signera(data)}`;
}

export function lasSession(token: string | undefined): string | null {
  if (!token) return null;
  const [data, signatur] = token.split(".");
  if (!data || !signatur) return null;
  const forvantad = Buffer.from(signera(data));
  const given = Buffer.from(signatur);
  if (forvantad.length !== given.length || !timingSafeEqual(forvantad, given)) return null;
  try {
    const { namn, exp } = JSON.parse(Buffer.from(data, "base64url").toString()) as { namn: string; exp: number };
    // Användaren måste fortfarande finnas – tas den bort i ANVANDARE slutar sessionen gälla.
    if (Date.now() > exp || !anvandare().has(namn)) return null;
    return namn;
  } catch {
    return null;
  }
}

export async function inloggadAnvandare(): Promise<string | null> {
  return lasSession((await cookies()).get(SESSION_COOKIE)?.value);
}

// Används först i varje API-route: returnerar användarnamnet, eller ett 401-svar.
export async function kravInloggning(): Promise<string | Response> {
  const namn = await inloggadAnvandare();
  return namn ?? Response.json({ fel: "Inte inloggad" }, { status: 401 });
}
