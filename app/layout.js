import './globals.css';

export const metadata = {
  title: 'Base Smart Wallet Profiler',
  description: 'Separating the New Retail Wave from Crypto Natives onchain.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
