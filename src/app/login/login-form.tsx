"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [error, action, pending] = useActionState(signIn, null);

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-semibold text-ink-2">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "password-error" : undefined}
          className="field w-full"
        />
        {error && (
          <p id="password-error" role="alert" className="text-sm font-semibold text-urgent">
            {error}
          </p>
        )}
      </div>
      <button type="submit" disabled={pending} className="btn btn-primary w-full justify-center">
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
