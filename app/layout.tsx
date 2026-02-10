import type { Metadata } from "next";
import "./globals.css";

// Force all routes to be dynamic
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://thedabbleverse.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Dabbleverse Dashboard",
  description: "Real-time cultural stock ticker",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.ico', type: 'image/x-icon', sizes: '32x32' },
    ],
    apple: '/favicon.ico',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'Dabbleverse',
    title: 'Dabbleverse Dashboard',
    description: 'Real-time cultural stock ticker',
    images: [{ url: '/favicon.ico', width: 32, height: 32, alt: 'Dabbleverse' }],
  },
  twitter: {
    card: 'summary',
    title: 'Dabbleverse Dashboard',
    description: 'Real-time cultural stock ticker',
    images: ['/favicon.ico'],
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
