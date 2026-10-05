"use client";

import { useTransition } from "react";
import type { ActionResult } from "@/app/actions";
import { useToast } from "./toast";

/** Run a server action, show its message as a toast, and expose pending state. */
export function useAction() {
  const [pending, start] = useTransition();
  const toast = useToast();
  const run = (fn: () => Promise<ActionResult>, onOk?: (r: ActionResult) => void) =>
    start(async () => {
      try {
        const r = await fn();
        toast(r.message, r.ok ? "ok" : "error");
        if (r.ok) onOk?.(r);
      } catch (err) {
        toast((err as Error).message || "Something went wrong. Check the server log.", "error");
      }
    });
  return { pending, run };
}
