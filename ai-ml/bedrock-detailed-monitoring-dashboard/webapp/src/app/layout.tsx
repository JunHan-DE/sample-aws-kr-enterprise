import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { Providers } from '@/components/providers';
import { Sidebar } from '@/components/dashboard/Sidebar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Bedrock Monitor',
  description: 'Amazon Bedrock usage and cost monitoring dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <Sidebar />
          <main className="min-h-screen p-4 pt-16 md:ml-64 md:p-6 md:pt-6">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
