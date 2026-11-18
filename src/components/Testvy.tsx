"use client";

import { useCallback, useEffect, useState } from "react";
import type { Testkorning } from "@/lib/typer";

export default function Testvy() {
  const [senaste, setSenaste] = useState<Testkorning | null>(null);
  const [antalMedFacit, setAntalMedFacit] = useState(0);
  const [bekrafta, setBekrafta] = useState<null | "alla" | "fel">(null);

  const hamta = useCallback(async () => {
    const svar = await fetch("/api/testa", { cache: "no-store" });
    if (!svar.ok) return;
    const data = await svar.json();
    setSenaste(data.senaste);
    setAntalMedFacit(data.antalMedFacit);
  }, []);

  const pagar = senaste !== null && !senaste.klar;

  useEffect(() => {
    hamta();
    if (!pagar) return;
    const intervall = setInterval(hamta, 2000);
    return () => clearInterval(intervall);
  }, [hamta, pagar]);

  const starta = async (baraFel: boolean) => {
    setBekrafta(null);
    await fetch("/api/testa", { method: "POST", body: JSON.stringify({ baraFel }) });
    await hamta();
  };

  const ratt = senaste?.rader.filter((r) => r.ratt === true).length ?? 0;
  const fel = senaste?.rader.filter((r) => r.ratt !== true).length ?? 0;
  const sorterade = [...(senaste?.rader ?? [])].sort((a, b) => Number(a.ratt === true) - Number(b.ratt === true));

  return (
    <section className="testvy">
      <p className="meta">
        Kör frågorna genom alla agenter och låter en domare jämföra svaren med FACIT.md. Ärendena i inkorgen påverkas
        inte. Varje fråga förbrukar API-krediter, ungefär som när ett vanligt meddelande körs.
      </p>

      {bekrafta ? (
        <div className="bekrafta">
          <p>
            {bekrafta === "alla"
              ? `Kör alla ${antalMedFacit} frågor med facit?`
              : `Kör om de ${fel} frågor som blev fel förra gången?`}
          </p>
          <div className="knappar">
            <button onClick={() => starta(bekrafta === "fel")}>Ja, kör</button>
            <button className="sekundar" onClick={() => setBekrafta(null)}>
              Avbryt
            </button>
          </div>
        </div>
      ) : (
        <div className="knappar">
          <button disabled={pagar || antalMedFacit === 0} onClick={() => setBekrafta("alla")}>
            Testa alla ({antalMedFacit})
          </button>
          {senaste?.klar && fel > 0 && (
            <button className="sekundar" disabled={pagar} onClick={() => setBekrafta("fel")}>
              Testa bara de {fel} som blev fel
            </button>
          )}
        </div>
      )}

      {senaste && (
        <>
          <h2 className="resultatrubrik">
            {pagar
              ? `Testar … ${senaste.rader.length} av ${senaste.antal} klara`
              : `${ratt} av ${senaste.antal} rätt`}
          </h2>
          <p className="meta">Startad {new Date(senaste.startad).toLocaleString("sv-SE")}</p>
          <div className="matare">
            <span style={{ width: `${(ratt / Math.max(senaste.antal, 1)) * 100}%` }} className="ratt" />
            <span style={{ width: `${(fel / Math.max(senaste.antal, 1)) * 100}%` }} className="fel" />
          </div>

          <ol className="testlista">
            {sorterade.map((r) => (
              <li key={r.id} className={r.ratt === true ? "ratt" : "fel"}>
                <details>
                  <summary>
                    <span className="markering">{r.ratt === true ? "Rätt" : "Fel"}</span>
                    <span className="testid">{r.id}</span>
                    <span className="kommentar">{r.kommentar}</span>
                  </summary>
                  <div className="testdetalj">
                    <h3>Fråga</h3>
                    <p>{r.fraga}</p>
                    <h3>Facit</h3>
                    <p>{r.facit}</p>
                    <h3>Agenternas svar</h3>
                    <pre className="svar">{r.svar || "–"}</pre>
                    <details className="underlag">
                      <summary>Underlag från Utredaren</summary>
                      <pre>{r.fakta}</pre>
                    </details>
                  </div>
                </details>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
