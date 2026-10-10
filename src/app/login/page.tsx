"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password.");
    } else {
      router.push(params.get("callbackUrl") ?? "/");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 to-indigo-500 text-2xl text-white shadow-xl shadow-teal-500/20">
            🦷
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold">Smile Studio</h1>
            <p className="text-sm text-muted">Sign in to your account</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" required autoComplete="email" className="input mt-1" placeholder="you@clinic.com" />
          </div>
          <div>
            <label className="label">Password</label>
            <input name="password" type="password" required autoComplete="current-password" className="input mt-1" placeholder="••••••••" />
          </div>
          {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          Smile Studio Dental CRM · Staff access only
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
