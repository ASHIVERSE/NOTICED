"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSignup(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    const { data, error } =
      await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.replace("/");
      return;
    }

    setMessage(
      "Account created. Check your email to confirm your account, then log in."
    );

    setLoading(false);
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
            Create your account
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Start with an empty watchlist and build your own attention profile.
          </p>

          <form
            onSubmit={handleSignup}
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
                minLength={6}
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-cyan-400/50"
                placeholder="At least 6 characters"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-xs text-red-400">
                {error}
              </div>
            )}

            {message && (
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-xs text-emerald-400">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-black transition hover:bg-cyan-300 disabled:opacity-50"
            >
              {loading
                ? "Creating account..."
                : "Create account"}
            </button>

          </form>

          <div className="mt-6 text-center text-xs text-slate-500">
            Already have an account?{" "}

            <Link
              href="/login"
              className="font-semibold text-cyan-400 hover:text-cyan-300"
            >
              Log in
            </Link>
          </div>

        </div>
      </div>

    </main>
  );
}