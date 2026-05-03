import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL('https://base-smart-profiler.vercel.app'),
  title: 'Base Smart Wallet Profiler',
  description: 'Separating the New Retail Wave from Crypto Natives onchain.',
  openGraph: {
    title: 'Base Smart Wallet Profiler',
    description: 'Separating the New Retail Wave from Crypto Natives onchain.',
    url: 'https://base-smart-profiler.vercel.app',
    siteName: 'Base Smart Wallet Profiler',
    images: [
      {
        url: '/opengraph-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Base Smart Wallet Profiler Dashboard',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Base Smart Wallet Profiler',
    description: 'Separating the New Retail Wave from Crypto Natives onchain.',
    images: ['/opengraph-image.jpg'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="base:app_id" content="69f77f5b879b4ae3fa1c70a1" />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
