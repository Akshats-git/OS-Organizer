import type { Metadata } from "next";
import { BrandMark } from "@/components/icons";
import { authMode, safeNext } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const locked = authMode() === "locked";

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="panel w-full max-w-sm overflow-hidden shadow-[var(--shadow-float)]">
        {/* The network's line colors, like the stripe on a station sign. */}
        <div className="flex h-1.5" aria-hidden>
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="flex-1" style={{ background: `var(--line-${i})` }} />
          ))}
        </div>
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-2.5">
            <BrandMark className="size-7" />
            <span className="type-display text-[1.375rem]">OS Organizer</span>
          </div>
          <h1 className="type-display mt-8 text-[2.5rem] leading-none">Sign in</h1>
          {locked ? (
            <p className="mt-4 text-sm text-ink-2">
              Sign-in isn&apos;t set up yet. Add <code className="font-semibold text-ink">APP_PASSWORD</code> and{" "}
              <code className="font-semibold text-ink">SESSION_SECRET</code> to the host&apos;s environment variables, then redeploy.
            </p>
          ) : (
            <LoginForm next={safeNext(next)} />
          )}
        </div>
      </div>
    </main>
  );
}
