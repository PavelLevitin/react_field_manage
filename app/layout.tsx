import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ניהול זמני מגרש",
  description: "Field schedule manager",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
