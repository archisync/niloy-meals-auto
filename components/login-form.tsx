"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    setLoading(false);

    if (!response.ok) {
      setError("Invalid username or password");
      return;
    }

    router.replace("/");
    router.refresh();
  };

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-sm rounded-3xl border border-violet-300/30 bg-[#2a2340] p-6 text-violet-100 shadow-xl"
    >
      <h1 className="mb-4 text-center text-2xl font-bold text-violet-100">Meals Login</h1>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-violet-300">Username</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="w-full rounded-xl border border-violet-300/30 bg-[#332a4d] px-3 py-2 text-violet-100 outline-none focus:border-violet-400"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-violet-300">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-violet-300/30 bg-[#332a4d] px-3 py-2 text-violet-100 outline-none focus:border-violet-400"
            required
          />
        </label>
      </div>
      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="mt-5 w-full rounded-xl bg-violet-600 px-4 py-2 font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-violet-800"
      >
        {loading ? "Logging in..." : "Login"}
      </button>
    </form>
  );
}
