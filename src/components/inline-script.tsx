"use client";

/**
 * An inline script that runs during HTML parsing (before first paint) without
 * React warnings. The server renders it as JavaScript; on the client it becomes
 * inert `text/plain`, and suppressHydrationWarning lets the DOM win, which also
 * covers browser extensions that inject their own <script> into <head>.
 * Pattern from node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
