"use client";

import clsx from "clsx";
import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

type Theme = "system" | "light" | "dark";
const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Match system", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

const listeners = new Set<() => void>();
function read(): Theme {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "dark" ? t : "system";
}

export function setTheme(theme: Theme) {
  try {
    if (theme === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", theme);
  } catch {}
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  listeners.forEach((l) => l());
}

export function useTheme() {
  return useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    read,
    () => "system" as Theme,
  );
}

export function ThemeToggle() {
  const theme = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className="flex rounded-[var(--radius-control)] bg-panel-2 p-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => setTheme(value)}
          className={clsx(
            "flex flex-1 items-center justify-center rounded-md py-1.5 transition-colors",
            theme === value ? "bg-panel text-ink shadow-[0_1px_2px_rgb(0_0_0/0.12)]" : "text-ink-3 hover:text-ink",
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
