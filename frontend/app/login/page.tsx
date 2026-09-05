"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");

    const { error } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.replace("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07090c] px-5 text-white">

      <div className="w-full max-w-md">

        <div className="mb-8 text-center">

          <div className="text-4xl font-black tracking-tight">
            NOTICED
            <span className="text-cyan-400">.</span>
          </div>

          <p className="mt-3 text-sm text-slate-500">
            Your market attention engine
          </p>

        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0c1015] p-6">

          <h1 className="text-2xl font-bold">
            Welcome back
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Log in to access your watchlist.
          </p>

          <form
            onSubmit={handleLogin}
            className="mt-6 space-y-4"
          >

            <div>
              <label className="text-xs text-slate-400">
                Email
              </label>

              <input
                type="email"
                required
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-cyan-400/50"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400">
                Password
              </label>

              <input
                type="password"
                required
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-cyan-400/50"
                placeholder="Your password"
              />
            </div>
                
            {error && (
              <div className="rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-xs text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-black transition hover:bg-cyan-300 disabled:opacity-50"
            >
              {loading
                ? "Logging in..."
                : "Log in"}
            </button>

          </form>
<div className="mt-2 text-right">
  <Link
    href="/forgot-password"
    className="text-xs text-cyan-400 hover:text-cyan-300"
  >
    Forgot password?
  </Link>
</div>
          <div className="mt-6 text-center text-xs text-slate-500">

            Don't have an account?{" "}

            <Link
              href="/signup"
              className="font-semibold text-cyan-400 hover:text-cyan-300"
            >
              Create one
            </Link>

          </div>

        </div>

      </div>

    </main>
  );
}