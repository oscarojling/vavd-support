"use client";

import { useCallback, useEffect, useState } from "react";
import type { Arende, Handelse, Inkorgsrad, Kanal, Meddelande } from "@/lib/typer";
import Testvy from "./Testvy";

type Flik = "inkorg" | "att_godkanna" | "skickat" | "behover_manniska" | "test";

const KANALTEXT: Record<Kanal, string> = { mejl: "Mejl", slack: "Slack", teams: "Teams" };

function statusFor(r: Inkorgsrad): { klass: string; text: string } {
  if (r.ko === "arbetar") return { klass: "kor", text: "Agenterna arbetar …" };
  if (r.ko === "i_ko") return { klass: "kor", text: "I kö" };
  if (!r.arende) return { klass: "ny", text: "Ny – inte körd" };
  return {
    att_godkanna: { klass: "att_godkanna", text: "Väntar på dig" },
    skickat: {
      klass: "skickat",
      text: r.meddelande.kanal !== "mejl" ? "Besvarat i kanalen" : r.arende.autoskickat ? "Skickat automatiskt" : "Skickat",
    },
    behover_manniska: { klass: "behover_manniska", text: "Behöver människa" },
    avvisat: { klass: "avvisat", text: "Avvisat" },
  }[r.arende.status];
}

export default function Panel({ anvandare }: { anvandare: string }) {
  const [rader, setRader] = useState<Inkorgsrad[]>([]);
  const [flik, setFlik] = useState<Flik>("inkorg");
  const [valt, setValt] = useState<string | null>(null);
  const [visaNytt, setVisaNytt] = useState(false);

  const hamta = useCallback(async () => {
    const svar = await fetch("/api/inkorg", { cache: "no-store" });
    if (svar.status === 401) {
      window.location.href = "/logga-in";
      return;
    }
    if (svar.ok) setRader(await svar.json());
  }, []);

  const loggaUt = async () => {
    await fetch("/api/logga-ut", { method: "POST" });
    window.location.href = "/logga-in";
  };

  const nagotPagar = rader.some((r) => r.ko);

  useEffect(() => {
    hamta();
    const intervall = setInterval(hamta, nagotPagar ? 1500 : 5000);
    return () => clearInterval(intervall);
  }, [hamta, nagotPagar]);

  const koa = async (body: object) => {
    await fetch("/api/hantera", { method: "POST", body: JSON.stringify(body) });
    await hamta();
  };

  const antal = (status: string) => rader.filter((r) => r.arende?.status === status && !r.ko).length;
  const vantande = rader.filter((r) => !r.arende && !r.ko).length;

  const synliga = rader.filter((r) => {
    if (flik === "inkorg") return true;
    return r.arende?.status === flik && !r.ko;
  });
  const vald = rader.find((r) => r.meddelande.id === valt);

  const flikar: { id: Flik; text: string; antal?: number }[] = [
    { id: "inkorg", text: "Inkorg", antal: rader.length },
    { id: "att_godkanna", text: "Att godkänna", antal: antal("att_godkanna") },
    { id: "skickat", text: "Skickat", antal: antal("skickat") },
    { id: "behover_manniska", text: "Behöver människa", antal: antal("behover_manniska") },
    { id: "test", text: "Test mot facit" },
  ];

  return (
    <main className="sida">
      <header className="sidhuvud">
        <div>
          <h1>Vävd kundservice</h1>
          <p className="underrubrik">Sorteraren → Utredaren → Skribenten → Granskaren → du</p>
        </div>
        <div className="knappar">
          <span className="inloggad">
            Inloggad som {anvandare} ·{" "}
            <button className="lank" onClick={loggaUt}>
              Logga ut
            </button>
          </span>
          <button className="sekundar" onClick={() => setVisaNytt((v) => !v)}>
            Nytt meddelande
          </button>
          {vantande > 0 && (
            <button onClick={() => koa({ allaVantande: true })}>Kör {vantande} som inte körts</button>
          )}
        </div>
      </header>

      {visaNytt && (
        <NyttMeddelande
          klar={(id) => {
            setVisaNytt(false);
            setFlik("inkorg");
            hamta().then(() => setValt(id));
          }}
        />
      )}

      <nav className="flikar">
        {flikar.map((f) => (
          <button key={f.id} className={flik === f.id ? "aktiv" : ""} onClick={() => setFlik(f.id)}>
            {f.text}
            {f.antal !== undefined && f.antal > 0 && <span className="antal">{f.antal}</span>}
          </button>
        ))}
      </nav>

      {flik === "test" ? (
        <Testvy />
      ) : (
        <div className="layout">
          <ol className="inkorg">
            {synliga.length === 0 && <li className="tom">Inget här just nu.</li>}
            {synliga.map((r) => {
              const s = statusFor(r);
              return (
                <li key={r.meddelande.id}>
                  <button
                    className={`post ${valt === r.meddelande.id ? "vald" : ""}`}
                    onClick={() => setValt(r.meddelande.id)}
                  >
                    <span className="meta">
                      {KANALTEXT[r.meddelande.kanal]} · {r.meddelande.fran}
                    </span>
                    <span className="amne">{r.meddelande.amne || r.meddelande.text.slice(0, 40)}</span>
                    <span className={`status ${s.klass}`}>{s.text}</span>
                  </button>
                </li>
              );
            })}
          </ol>

          <section className="detalj">
            {vald ? (
              <Detalj rad={vald} korOm={() => koa({ id: vald.meddelande.id })} uppdatera={hamta} />
            ) : (
              <p className="tom">Välj ett meddelande. Nya meddelanden körs automatiskt när de kommer in.</p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function Detalj({ rad, korOm, uppdatera }: { rad: Inkorgsrad; korOm: () => void; uppdatera: () => Promise<void> }) {
  const { meddelande: m, arende, ko, logg } = rad;
  const arPersonal = m.kanal !== "mejl";

  return (
    <article>
      <div className="detaljhuvud">
        <div>
          <h2>{m.amne || "Meddelande"}</h2>
          <p className="meta">
            {KANALTEXT[m.kanal]} · från {m.fran}
          </p>
        </div>
        {!ko && (
          <button className="sekundar liten" onClick={korOm}>
            {arende ? "Kör om" : "Kör agenterna"}
          </button>
        )}
      </div>

      {arPersonal ? (
        <Trad fran={m.fran} text={m.text} />
      ) : (
        <blockquote>{m.text}</blockquote>
      )}

      {(ko || logg.length > 0) && <Logg logg={logg} pagar={!!ko} />}

      {arende && !ko && (
        arPersonal ? (
          <PersonalSvar arende={arende} />
        ) : (
          <Kundsvar key={arende.uppdaterad} arende={arende} uppdatera={uppdatera} />
        )
      )}

      {arende && !ko && (
        <>
          {!arende.bedomning.godkand && arende.bedomning.problem.length > 0 && (
            <div className="granskning">
              <h3>Granskarens invändningar</h3>
              <ul>
                {arende.bedomning.problem.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          <details className="underlag">
            <summary>Underlag från Utredaren</summary>
            <pre>{arende.fakta}</pre>
          </details>
        </>
      )}
    </article>
  );
}

function Trad({ fran, text, agent }: { fran: string; text: string; agent?: boolean }) {
  return (
    <div className={`trad ${agent ? "agent" : ""}`}>
      <span className="avatar">{agent ? "V" : fran.slice(0, 1).toUpperCase()}</span>
      <div>
        <span className="tradnamn">{agent ? "Vävd-agenten" : fran}</span>
        <p>{text}</p>
      </div>
    </div>
  );
}

function PersonalSvar({ arende }: { arende: Arende }) {
  if (arende.status === "behover_manniska") {
    return (
      <div className="resultat">
        <p className="felruta">
          Granskaren godkände inte svaret efter {arende.forsok} försök, så inget skickades till kanalen.
        </p>
        <pre className="svar">{arende.svar}</pre>
      </div>
    );
  }
  return (
    <div className="svarstrad">
      <Trad fran="Vävd-agenten" text={arende.svar} agent />
    </div>
  );
}

function Kundsvar({ arende, uppdatera }: { arende: Arende; uppdatera: () => Promise<void> }) {
  const [svar, setSvar] = useState(arende.svar);
  const kanAndras = arende.status === "att_godkanna" || arende.status === "behover_manniska";

  const besluta = async (beslut: "skicka" | "avvisa") => {
    await fetch("/api/godkann", {
      method: "POST",
      body: JSON.stringify({ id: arende.meddelande.id, beslut, svar }),
    });
    await uppdatera();
  };

  return (
    <div className="resultat">
      <h3>Svarsmejl till {arende.meddelande.fran}</h3>
      {arende.beslutAv && (
        <p className="meta">
          {arende.status === "avvisat" ? "Avvisat" : "Godkänt och skickat"} av {arende.beslutAv}.
        </p>
      )}
      {arende.autoskickat && (
        <p className="meta">
          Skickades automatiskt: orderstatusfråga som Granskaren bedömde som säker.
          {arende.bedomning.motivering ? ` ${arende.bedomning.motivering}` : ""}
        </p>
      )}
      {!arende.autoskickat && arende.status === "att_godkanna" && arende.sortering.kategori === "orderstatus" && arende.bedomning.motivering && (
        <p className="meta">Skickades inte automatiskt: {arende.bedomning.motivering}</p>
      )}
      {kanAndras ? (
        <>
          <textarea value={svar} onChange={(e) => setSvar(e.target.value)} rows={12} />
          <div className="knappar">
            <button onClick={() => besluta("skicka")}>Godkänn och skicka</button>
            <button className="sekundar" onClick={() => besluta("avvisa")}>
              Avvisa
            </button>
          </div>
        </>
      ) : (
        <pre className="svar">{arende.svar}</pre>
      )}
    </div>
  );
}

function Logg({ logg, pagar }: { logg: Handelse[]; pagar: boolean }) {
  return (
    <details className="logg" open={pagar}>
      <summary>{pagar ? "Agenterna arbetar …" : "Så här jobbade agenterna"}</summary>
      <ol>
        {logg.map((h, i) =>
          h.typ === "steg" ? (
            <li key={i} className="steg">
              <strong>{h.agent}</strong> {h.text}
              {h.detalj && (
                <details>
                  <summary>Visa</summary>
                  <pre>{h.detalj}</pre>
                </details>
              )}
            </li>
          ) : h.typ === "verktyg" ? (
            <li key={i} className="verktyg">
              ↳ {h.namn}
              {h.indata && <code>{h.indata}</code>}
            </li>
          ) : (
            <li key={i} className="felruta">
              Fel: {h.text}
            </li>
          ),
        )}
        {pagar && <li className="verktyg">…</li>}
      </ol>
    </details>
  );
}

function NyttMeddelande({ klar }: { klar: (id: string) => void }) {
  const [kanal, setKanal] = useState<Kanal>("mejl");
  const [fran, setFran] = useState("");
  const [amne, setAmne] = useState("");
  const [text, setText] = useState("");
  const [fel, setFel] = useState("");

  const skicka = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fran.trim() || !text.trim()) {
      setFel("Fyll i avsändare och meddelande.");
      return;
    }
    const svar = await fetch("/api/inkorg", { method: "POST", body: JSON.stringify({ kanal, fran, amne, text }) });
    const nytt = (await svar.json()) as Meddelande;
    klar(nytt.id);
  };

  return (
    <form className="nytt" onSubmit={skicka}>
      <label>
        Kanal
        <select value={kanal} onChange={(e) => setKanal(e.target.value as Kanal)}>
          <option value="mejl">Mejl (kund)</option>
          <option value="slack">Slack (personal)</option>
          <option value="teams">Teams (personal)</option>
        </select>
      </label>
      <label>
        Från
        <input
          value={fran}
          onChange={(e) => {
            setFran(e.target.value);
            setFel("");
          }}
          placeholder={kanal === "mejl" ? "sara.lind@example.com" : "Lisa (butik Göteborg)"}
        />
      </label>
      <label>
        Ämne
        <input value={amne} onChange={(e) => setAmne(e.target.value)} />
      </label>
      <label className="bred">
        Meddelande
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setFel("");
          }}
          rows={4}
        />
      </label>
      {fel && <p className="felruta">{fel}</p>}
      <button type="submit">Skicka in – agenterna börjar direkt</button>
    </form>
  );
}
