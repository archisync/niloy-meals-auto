import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  getServerEnv();
  const cookieStore = await cookies();
  if (isValidSession(cookieStore.get(SESSION_COOKIE)?.value)) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#161427] via-[#221b36] to-[#161427] px-4">
      <LoginForm />
    </div>
  );
}
