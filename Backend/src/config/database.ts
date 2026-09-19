import dotenv from "dotenv";
import { Pool, type PoolConfig, type QueryResult, type QueryResultRow } from "pg";

dotenv.config({ quiet: true });

const poolConfig: PoolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
    }
  : {
      host: process.env.POSTGRES_HOST ?? "127.0.0.1",
      port: Number.parseInt(process.env.POSTGRES_PORT ?? "5433", 10),
      user: process.env.POSTGRES_USER ?? "postgres",
      password: process.env.POSTGRES_PASSWORD ?? "postgres",
      database: process.env.POSTGRES_DB ?? "devpilot",
    };

export const db = new Pool({
  ...poolConfig,
  max: Number.parseInt(process.env.POSTGRES_POOL_MAX ?? "10", 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  query_timeout: Number.parseInt(
    process.env.POSTGRES_QUERY_TIMEOUT_MS ?? "20000",
    10,
  ),
});

db.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error", error);
});

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[],
): Promise<QueryResult<T>> {
  return db.query<T>(text, values);
}

export async function checkDatabaseConnection(): Promise<void> {
  await query("SELECT 1");
}

export async function closeDatabase(): Promise<void> {
  await db.end();
}
