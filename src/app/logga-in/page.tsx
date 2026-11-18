"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function Formular() {
  const router = useRouter();
  const nasta = useSearchParams().get("nasta");
  const [namn, setNamn] = useState("");
  const [losenord, setLosenord] = useState("");
  const [fel, setFel] = useState("");
  const [skickar, setSkickar] = useState(false);

  const loggaIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namn.trim() || !losenord) {
      setFel("Fyll i namn och lösenord.");
      return;
    }
    setSkickar(true);
    const svar = await fetch("/api/logga-in", { method: "POST", body: JSON.stringify({ namn, losenord }) });
    setSkickar(false);
    if (!svar.ok) {
      setFel(((await svar.json().catch(() => ({}))) as { fel?: string }).fel ?? "Inloggningen misslyckades.");
      return;
    }
    // Bara interna sökvägar, så att länken inte kan skicka vidare till en annan webbplats.
    router.replace(nasta?.startsWith("/") && !nasta.startsWith("//") ? nasta : "/");
    router.refresh();
  };

  return (
    <form className="inloggning" onSubmit={loggaIn}>
      <h1>Vävd kundservice</h1>
      <p className="meta">Logga in för att se ärenden och agenternas svar.</p>
      <label>
        Namn
        <input
          autoComplete="username"
          value={namn}
          onChange={(e) => {
            setNamn(e.target.value);
            setFel("");
          }}
        />
      </label>
      <label>
        Lösenord
        <input
          type="password"
          autoComplete="current-password"
          value={losenord}
          onChange={(e) => {
            setLosenord(e.target.value);
            setFel("");
          }}
        />
      </label>
      {fel && <p className="felruta">{fel}</p>}
      <button type="submit" disabled={skickar}>
        {skickar ? "Loggar in …" : "Logga in"}
      </button>
    </form>
  );
}

export default function LoggaIn() {
  return (
    <main className="sida">
      <Suspense>
        <Formular />
      </Suspense>
    </main>
  );
}
