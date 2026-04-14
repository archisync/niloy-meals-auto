import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { MealsDashboard } from "@/components/meals-dashboard";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";

export default async function Home() {
  getServerEnv();
  const cookieStore = await cookies();

  if (!isValidSession(cookieStore.get(SESSION_COOKIE)?.value)) {
    redirect("/login");
  }

  return <MealsDashboard />;
}
