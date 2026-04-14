import { createClient } from "@libsql/client";

import { getServerEnv } from "@/lib/env";

let client: ReturnType<typeof createClient> | null = null;

export function getTursoClient() {
  if (client) {
    return client;
  }

  const env = getServerEnv();

  client = createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });

  return client;
}

export async function ensureSchema() {
  const db = getTursoClient();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_state (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}
