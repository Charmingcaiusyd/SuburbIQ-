import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SuburbIQ",
  description: "Sydney Property Data & Buyer Decision Platform."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
