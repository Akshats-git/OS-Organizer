import clsx from "clsx";
import { lineVar, onLineVar } from "@/lib/lines";

/** A repo's line bullet: its two-letter code on its line color, like a metro roundel. */
export function LineBullet({
  code,
  colorIndex,
  size = "md",
  className,
}: {
  code: string;
  colorIndex: number;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const dims = {
    sm: "size-5 text-[0.625rem]",
    md: "size-7 text-[0.8125rem]",
    lg: "size-10 text-base",
    xl: "size-14 text-[1.375rem]",
  }[size];
  return (
    <span
      aria-hidden
      className={clsx("inline-grid shrink-0 place-items-center rounded-full type-display leading-none", dims, className)}
      style={{ background: lineVar(colorIndex), color: onLineVar(colorIndex), letterSpacing: "0.02em" }}
    >
      {code}
    </span>
  );
}
