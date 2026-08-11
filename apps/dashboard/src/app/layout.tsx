import type { Metadata } from "next";
import { DashboardLanguage } from "@/components/dashboard-language";
import { getDashboardLanguage } from "@/lib/dashboard-i18n-server";
import "./globals.css";

export const metadata: Metadata = {
  title: "onePixel Control",
  description: "Regia sincronizzata per stadi, concerti ed eventi dal vivo.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const language = await getDashboardLanguage();
  return (
    <html lang={language}>
      <body><DashboardLanguage initialLanguage={language}>{children}</DashboardLanguage></body>
    </html>
  );
}
