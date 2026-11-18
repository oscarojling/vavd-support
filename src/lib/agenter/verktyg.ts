import Database from "better-sqlite3";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { tool } from "ai";
import { z } from "zod";

const KODMAPP = path.join(process.cwd(), "butik");
const DB = path.join(process.cwd(), "data", "butik.db");

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

function lasbarDatabas() {
  return new Database(DB, { readonly: true, fileMustExist: true });
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

export function databasSchema(): string {
  const db = lasbarDatabas();
  try {
    const rader = db.prepare("SELECT sql FROM sqlite_master WHERE type='table'").all() as { sql: string }[];
    return rader.map((r) => r.sql).join("\n");
  } finally {
    db.close();
  }
}

export function korSql(sql: string): string {
  const fraga = sql.trim().replace(/;\s*$/, "");
  if (!/^(select|with)\b/i.test(fraga) || fraga.includes(";")) {
    return "Fel: bara en enskild SELECT-fråga är tillåten.";
  }
  const db = lasbarDatabas();
  try {
    const rader = db.prepare(fraga).all() as Record<string, unknown>[];
    if (rader.length === 0) return "Inga rader.";
    const kolumner = Object.keys(rader[0]);
    return [kolumner.join(" | "), ...rader.slice(0, 50).map((r) => kolumner.map((k) => String(r[k])).join(" | "))].join("\n");
  } finally {
    db.close();
  }
}

function sakert(fn: () => string): string {
  try {
    return fn();
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
      description: "Kör en SELECT-fråga mot butikens SQLite-databas. Bara läsning är tillåten.",
      inputSchema: z.object({ sql: z.string() }),
      execute: async ({ sql }) => {
        logga("kor_sql", sql);
        return sakert(() => korSql(sql));
      },
    }),
  };
}
