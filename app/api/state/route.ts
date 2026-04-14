import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { ensureSchema, getTursoClient } from "@/lib/turso";

const STATE_ID = "default";

type Payload = {
  data?: string;
  updatedAt?: string;
};

async function ensureAuthenticated() {
  const cookieStore = await cookies();
  const isAuthenticated = isValidSession(cookieStore.get(SESSION_COOKIE)?.value);

  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export async function GET() {
  const unauthorized = await ensureAuthenticated();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    await ensureSchema();
    const db = getTursoClient();
    const result = await db.execute({
      sql: "SELECT data, updated_at FROM app_state WHERE id = ?",
      args: [STATE_ID],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ data: null, updatedAt: null });
    }

    return NextResponse.json({
      data: result.rows[0].data,
      updatedAt: result.rows[0].updated_at,
    });
  } catch {
    return NextResponse.json({ data: null, updatedAt: null }, { status: 200 });
  }
}

export async function POST(request: Request) {
  const unauthorized = await ensureAuthenticated();
  if (unauthorized) {
    return unauthorized;
  }

  const body = (await request.json().catch(() => null)) as Payload | null;

  if (!body?.data || !body.updatedAt) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    await ensureSchema();
    const db = getTursoClient();

    await db.execute({
      sql: `
        INSERT INTO app_state (id, data, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          data = excluded.data,
          updated_at = excluded.updated_at
      `,
      args: [STATE_ID, body.data, body.updatedAt],
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 202 });
  }
}
