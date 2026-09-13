import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsDrizzleDb?: NodePgDatabase<Record<string, never>>;
};

/**
 * Ленивая инициализация подключения к базе.
 *
 * Раньше модуль бросал ошибку при импорте, если DATABASE_URL не задан,
 * из-за чего `next build` падал на этапе сбора данных страниц в окружении
 * без переменных окружения (например, в CI). Теперь пул создаётся только
 * при первом реальном обращении к базе.
 */
function createDb(): NodePgDatabase<Record<string, never>> {
  if (globalForDb.__arenaNextJsDrizzleDb) {
    return globalForDb.__arenaNextJsDrizzleDb;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const pool =
    globalForDb.__arenaNextJsPostgresqlPool ??
    new Pool({ connectionString: databaseUrl });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.__arenaNextJsPostgresqlPool = pool;
  }

  const db = drizzle(pool);
  globalForDb.__arenaNextJsDrizzleDb = db;
  return db;
}

export const db = new Proxy({} as NodePgDatabase<Record<string, never>>, {
  get(_target, prop, receiver) {
    const real = createDb() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export const pool = new Proxy({} as Pool, {
  get(_target, prop, receiver) {
    const real = createDb() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
