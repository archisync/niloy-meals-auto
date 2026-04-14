import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createSessionValue, SESSION_COOKIE } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { username?: string; password?: string }
    | null;

  if (!body?.username || !body?.password) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
  }

  const env = getServerEnv();

  if (body.username !== env.USERNAME || body.password !== env.PASSWORD) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const cookieStore = await cookies();

  cookieStore.set({
    name: SESSION_COOKIE,
    value: createSessionValue(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return NextResponse.json({ ok: true });
}
