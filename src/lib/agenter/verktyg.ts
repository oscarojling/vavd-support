import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";

const KODMAPP = path.join(process.cwd(), "butik");

function sakerSokvag(filnamn: string): string {
  const sokvag = path.resolve(KODMAPP, filnamn);
  if (!sokvag.startsWith(KODMAPP + path.sep) || !statSync(sokvag, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Filen ${filnamn} finns inte i kodbasen`);
  }
  return sokvag;
}

function filer(): string[] {
  return readdirSync(KODMAPP).filter((f) => statSync(path.join(KODMAPP, f)).isFile()).sort();
}

export function listaFiler(): string {
  return filer().join("\n");
}

export function lasFil(filnamn: string): string {
  return readFileSync(sakerSokvag(filnamn), "utf-8")
    .split("\n")
    .map((rad, i) => `${String(i + 1).padStart(3)}: ${rad}`)
    .join("\n");
}

export function sokIKod(sokord: string): string {
  const traffar: string[] = [];
  const nal = sokord.toLowerCase();
  for (const fil of filer()) {
    readFileSync(path.join(KODMAPP, fil), "utf-8")
      .split("\n")
      .forEach((rad, i) => {
        if (rad.toLowerCase().includes(nal)) traffar.push(`${fil}:${i + 1}: ${rad.trim()}`);
      });
  }
  return traffar.join("\n") || "Inga träffar.";
}

export async function databasSchema(): Promise<string> {
  const kolumner = await db()<{ tabell: string; kolumn: string; typ: string }[]>`
    SELECT table_name AS tabell, column_name AS kolumn, data_type AS typ
    FROM information_schema.columns WHERE table_schema = 'butik'
    ORDER BY table_name, ordinal_position`;
  const tabeller = new Map<string, string[]>();
  for (const k of kolumner) tabeller.set(k.tabell, [...(tabeller.get(k.tabell) ?? []), `${k.kolumn} ${k.typ}`]);
  return [...tabeller].map(([t, k]) => `${t} (${k.join(", ")})`).join("\n");
}

// Agentens SQL körs i en skrivskyddad transaktion där bara butikens tabeller syns.
// Hänvisningar till andra scheman (appens egna tabeller, systemtabeller) stoppas.
const FORBJUDET = /\b(public|pg_catalog|information_schema|pg_toast)\s*\.|\bpg_\w+|\b(set_config|current_setting|dblink|lo_\w+)\s*\(/i;

function formatera(varde: unknown): string {
  if (varde instanceof Date) return varde.toISOString().slice(0, 10);
  return String(varde);
}

export async function korSql(fraga: string): Promise<string> {
  const sql = fraga.trim().replace(/;\s*$/, "");
  if (!/^(select|with)\b/i.test(sql) || sql.includes(";")) return "Fel: bara en enskild SELECT-fråga är tillåten.";
  if (FORBJUDET.test(sql)) return "Fel: bara butikens tabeller får läsas.";
  const rader = await db().begin("read only", async (tx) => {
    await tx`SET LOCAL search_path TO butik`;
    await tx`SET LOCAL statement_timeout = '5s'`;
    return tx.unsafe(sql);
  }) as unknown as Record<string, unknown>[];
  if (rader.length === 0) return "Inga rader.";
  const kolumner = Object.keys(rader[0]);
  return [kolumner.join(" | "), ...rader.slice(0, 50).map((r) => kolumner.map((k) => formatera(r[k])).join(" | "))].join("\n");
}

async function sakert(fn: () => string | Promise<string>): Promise<string> {
  try {
    return await fn();
  } catch (fel) {
    return `Fel: ${(fel as Error).message}`;
  }
}

export function skapaVerktyg(logga: (namn: string, indata: string) => void) {
  return {
    lista_filer: tool({
      description: "Listar alla filer i butikens kodbas.",
      inputSchema: z.object({}),
      execute: async () => {
        logga("lista_filer", "");
        return sakert(listaFiler);
      },
    }),
    las_fil: tool({
      description: "Läser en fil i butikens kodbas, med radnummer.",
      inputSchema: z.object({ filnamn: z.string().describe("t.ex. returns.ts") }),
      execute: async ({ filnamn }) => {
        logga("las_fil", filnamn);
        return sakert(() => lasFil(filnamn));
      },
    }),
    sok_i_kod: tool({
      description: "Söker efter ett ord eller uttryck (skiftlägesokänsligt) i alla filer i kodbasen.",
      inputSchema: z.object({ sokord: z.string() }),
      execute: async ({ sokord }) => {
        logga("sok_i_kod", sokord);
        return sakert(() => sokIKod(sokord));
      },
    }),
    databas_schema: tool({
      description: "Visar databasens tabeller och kolumner.",
      inputSchema: z.object({}),
      execute: async () => {
        logga("databas_schema", "");
        return sakert(databasSchema);
      },
    }),
    kor_sql: tool({
      description: "Kör en SELECT-fråga mot butikens Postgres-databas (tabellerna kunder, ordrar, orderrader, rabattkoder, anvanda_koder). Bara läsning är tillåten.",
      inputSchema: z.object({ sql: z.string() }),
      execute: async ({ sql }) => {
        logga("kor_sql", sql);
        return sakert(() => korSql(sql));
      },
    }),
  };
}
