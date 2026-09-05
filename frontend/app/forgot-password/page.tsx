"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: `${window.location.origin}/reset-password`,
      }
    );

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMessage(
      "If an account exists for this email, a password reset link has been sent."
    );

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#07090b] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <div className="text-2xl font-black tracking-tight">
            NOTIC<span className="text-cyan-400">ED.</span>
          </div>

          <div className="mt-2 text-[10px] tracking-[0.28em] text-gray-500">
            YOUR MARKET ATTENTION ENGINE
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0c1014] p-7">
          <div className="mb-7">
            <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-400">
              Account Recovery
            </div>

            <h1 className="mt-3 text-3xl font-bold">
              Forgot your password?
            </h1>

            <p className="mt-3 text-sm leading-6 text-gray-400">
              Enter your email and we'll send you a secure password
              reset link.
            </p>
          </div>

          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="mb-2 block text-xs text-gray-400">
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="you@example.com"
                className="w-full rounded-xl border border-white/10 bg-[#080b0e] px-4 py-3 text-sm outline-none transition focus:border-cyan-400/50"
                required
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {message && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Sending..."
                : "Send reset link"}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-gray-500">
            <Link
              href="/login"
              className="text-gray-400 hover:text-white"
            >
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}