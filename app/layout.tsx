import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://wtfradar.com"),
  title: {
    default: "wtfradar · AI dating that checks the vibe first",
    template: "%s · wtfradar",
  },
  description:
    "A mobile-first AI dating platform where personal agents run structured virtual dates before people decide whether to meet.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.svg", type: "image/svg+xml" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "wtfradar",
  },
  openGraph: {
    title: "WTF Radar",
    description: "AI-assisted dating with human control at every step.",
    type: "website",
    siteName: "WTF Radar",
  },
};

export const viewport: Viewport = {
  themeColor: "#07070a",
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
      <body className="min-h-full bg-background font-sans text-foreground">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
