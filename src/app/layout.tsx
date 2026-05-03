export const metadata = {
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
  // 👇 ADD THIS NEW BLOCK RIGHT HERE 👇
  other: {
    'base:app_id': '69f77f5b879b4ae3fa1c70a1',
  },
};