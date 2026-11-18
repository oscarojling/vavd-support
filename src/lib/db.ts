import postgres from "postgres";

// En anslutning per serverinstans. Ligger på globalThis så att den inte skapas om
// vid varje omladdning i dev-läge. prepare: false behövs för Neons connection pooler.
const g = globalThis as unknown as { __vavdSql?: postgres.Sql };

export function db(): postgres.Sql {
  if (!g.__vavdSql) {
    const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL saknas. Lägg till Neon-databasen i Vercel och kopiera DATABASE_URL till .env.local.");
    g.__vavdSql = postgres(url, { max: 5, prepare: false, idle_timeout: 20, onnotice: () => {} });
  }
  return g.__vavdSql;
}
