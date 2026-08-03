import type { Metadata } from "next";
import { DashboardLanguage } from "@/components/dashboard-language";
import "./globals.css";

export const metadata: Metadata = {
  title: "onePixel Control",
  description: "Regia sincronizzata per stadi, concerti ed eventi dal vivo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body><DashboardLanguage>{children}</DashboardLanguage></body>
    </html>
  );
}
