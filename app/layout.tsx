import type { Metadata } from "next";
import "./globals.css";

// Force all routes to be dynamic
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Dabbleverse Dashboard",
  description: "Real-time cultural stock ticker",
  icons: {
    icon: '/dabbleverse-logo.png',
    apple: '/dabbleverse-logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
