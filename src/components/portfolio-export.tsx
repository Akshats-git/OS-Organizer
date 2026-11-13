"use client";

import { ClipboardCopy, Download } from "lucide-react";
import { useToast } from "./toast";

export function PortfolioExport({ markdown }: { markdown: string }) {
  const toast = useToast();
  const download = () => {
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "contributions.md" });
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="flex flex-wrap gap-2">
      <button
        className="btn btn-primary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(markdown);
            toast("Copied. Paste it into your proposal.");
          } catch {
            toast("Couldn’t reach the clipboard. Use Download instead.", "error");
          }
        }}
      >
        <ClipboardCopy className="size-4" /> Copy for proposal
      </button>
      <button className="btn btn-quiet" onClick={download}>
        <Download className="size-4" /> Download .md
      </button>
    </div>
  );
}
