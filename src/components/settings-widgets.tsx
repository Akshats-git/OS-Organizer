"use client";

import { RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { clearDemoData, syncNow } from "@/app/actions";
import { useAction } from "./use-action";

export function SyncButton({ disabled }: { disabled?: boolean }) {
  const { run, pending } = useAction();
  return (
    <button disabled={disabled || pending} onClick={() => run(() => syncNow())} className="btn btn-primary">
      <motion.span animate={pending ? { rotate: 360 } : { rotate: 0 }} transition={pending ? { repeat: Infinity, duration: 0.9, ease: "linear" } : { duration: 0 }} className="inline-flex">
        <RefreshCw className="size-4" />
      </motion.span>
      {pending ? "Syncing" : "Sync now"}
    </button>
  );
}

export function ClearDemoButton() {
  const { run, pending } = useAction();
  return (
    <button disabled={pending} onClick={() => confirm("Remove the demo orgs, repos, loops and inbox items?") && run(() => clearDemoData())} className="btn btn-quiet">
      Clear demo data
    </button>
  );
}
