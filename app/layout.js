export const metadata = {
  metadataBase: new URL('https://base-smart-profiler.vercel.app'),
  title: 'Base Smart Wallet Profiler',
  description: 'Tracking the new retail wave on Base through Coinbase Smart Wallet analytics.',
  openGraph: {
    title: 'Base Smart Wallet Profiler',
    description: 'Tracking the new retail wave on Base through Coinbase Smart Wallet analytics.',
    url: 'https://base-smart-profiler.vercel.app',
    siteName: 'Base Smart Wallet Profiler',
    images: [
      {
        url: '/opengraph-image.jpg', // Points to the file you just uploaded
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
    description: 'Tracking the new retail wave on Base through Coinbase Smart Wallet analytics.',
    images: ['/opengraph-image.jpg'], // Crucial for X/Twitter previews!
  },
};
