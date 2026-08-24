import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

// One grotesk for the interface, one mono for anything numeric. Timecodes,
// durations and resolutions are content in an editor, not decoration.
const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Context",
  description: "Direct video with a model in the room.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn("dark h-full antialiased", sans.variable, mono.variable)}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
