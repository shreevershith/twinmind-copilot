import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TwinMind Live Suggestions",
  description:
    "A live meeting copilot: record audio, watch real-time transcript, and get context-aware suggestions and chat answers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full bg-white text-zinc-900">{children}</body>
    </html>
  );
}
