import type { Metadata, Viewport } from "next";
import { Archivo, Inter } from "next/font/google";
import { themeInitScript } from "@/components/ThemeToggle";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

// Closest open alternative to JuiceUP's Europa Grotesk headline face.
const display = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "JuiceUP · Workshop",
  description: "Interaktivní otázky pro účastníky workshopů JuiceUP.",
};

export const viewport: Viewport = {
  themeColor: "#1f1c25",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="cs" className={`${inter.variable} ${display.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="relative min-h-full flex flex-col">
        <div className="ambient" aria-hidden />
        <div className="relative z-10 flex min-h-full flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
