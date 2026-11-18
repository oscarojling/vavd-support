import { after } from "next/server";

// Kör arbete efter att svaret skickats. På Vercel håller after() funktionen vid liv
// tills arbetet är klart (upp till routens maxDuration). Utanför en request
// (t.ex. i ett testskript) körs arbetet bara direkt.
export function iBakgrunden(arbete: () => Promise<unknown>): void {
  const sakert = () => arbete().catch((fel) => console.error("Bakgrundsjobb misslyckades:", fel));
  try {
    after(sakert);
  } catch {
    void sakert();
  }
}
