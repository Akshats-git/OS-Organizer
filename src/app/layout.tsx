import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Barlow_Condensed } from "next/font/google";
import { InlineScript } from "@/components/inline-script";
import "./globals.css";

const body = Atkinson_Hyperlegible_Next({ variable: "--font-body", subsets: ["latin"], adjustFontFallback: false, fallback: ["system-ui", "sans-serif"] });
const signage = Barlow_Condensed({ variable: "--font-signage", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "OS Organizer", template: "%s · OS Organizer" },
  description: "Track every open source contribution loop, from the first Discord ask to the merged PR.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e7ebef" },
    { media: "(prefers-color-scheme: dark)", color: "#0c121b" },
  ],
};

const themeScript = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${signage.variable}`} suppressHydrationWarning>
      <head>
        <InlineScript html={themeScript} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
