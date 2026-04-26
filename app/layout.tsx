import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://wtfradar.com"),
  title: {
    default: "WTF Radar · AI dating",
    template: "%s · WTF Radar",
  },
  description:
    "WTF Radar is an AI-assisted dating platform. Your agent runs structured virtual introductions; you decide every real-world next step.",
  applicationName: "WTF Radar",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "WTF Radar",
    description: "AI-assisted dating with human control at every step.",
    type: "website",
    siteName: "WTF Radar",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="stylesheet" href="https://use.typekit.net/qly1tpd.css" />
      </head>
      <body className="tk-fiona min-h-full bg-[var(--surface-base)] text-[var(--text-primary)]">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
