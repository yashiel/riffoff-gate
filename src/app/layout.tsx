import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ServiceWorkerRegistrar } from "@/components/shared/ServiceWorkerRegistrar";
import "./globals.css";

export const metadata: Metadata = {
  title: "RiffOff Gate",
  description: "Scan and validate event tickets",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RiffOff Gate",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0a0c",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="safe-top safe-bottom" suppressHydrationWarning>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
