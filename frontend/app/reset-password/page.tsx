"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [recoveryReady, setRecoveryReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkRecoverySession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (mounted && session) {
        setRecoveryReady(true);
        setChecking(false);
      } else if (mounted) {
        setChecking(false);
      }
    };

    checkRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setRecoveryReady(true);
        setChecking(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handlePasswordUpdate(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMessage(
      "Password updated successfully. Redirecting to login..."
    );

    await supabase.auth.signOut();

    setTimeout(() => {
      router.replace("/login");
    }, 1500);
  }

  if (checking) {
    return (
      <main className="min-h-screen bg-[#07090b] text-white flex items-center justify-center">
        <div className="text-sm text-gray-400">
          Verifying password reset link...
        </div>
      </main>
    );
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
              Set a new password.
            </h1>

            <p className="mt-3 text-sm leading-6 text-gray-400">
              Choose a new password for your NOTICED account.
            </p>
          </div>

          {!recoveryReady ? (
            <div>
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
                This password reset link is invalid or has expired.
              </div>

              <Link
                href="/login"
                className="mt-5 block text-center text-sm text-cyan-400 hover:text-cyan-300"
              >
                Back to login
              </Link>
            </div>
          ) : (
            <form
              onSubmit={handlePasswordUpdate}
              className="space-y-4"
            >
              <div>
                <label className="mb-2 block text-xs text-gray-400">
                  New password
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="At least 8 characters"
                  className="w-full rounded-xl border border-white/10 bg-[#080b0e] px-4 py-3 text-sm outline-none transition focus:border-cyan-400/50"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-xs text-gray-400">
                  Confirm new password
                </label>

                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  placeholder="Enter password again"
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
                  ? "Updating password..."
                  : "Update password"}
              </button>
            </form>
          )}

          <div className="mt-6 text-center text-xs text-gray-500">
            <Link
              href="/login"
              className="text-gray-400 hover:text-white"
            >
              Return to login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}