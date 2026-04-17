import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clawnection · Agentic Matchmaking MVP",
  description:
    "Romance-first agentic matchmaking prototype where personal agents run bounded virtual dates and humans stay in control.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-white font-sans text-zinc-900">{children}</body>
    </html>
  );
}
