import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Spidey Crawler — Operator Console',
  description: 'Real-time web crawler and search engine dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-surface text-text-primary antialiased">
        <header className="border-b border-border px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-accent font-bold text-lg tracking-tight">
              SPIDEY
            </span>
            <span className="text-text-muted text-xs uppercase tracking-widest">
              Crawler Console
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-xs text-text-muted">SYSTEM ONLINE</span>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </body>
    </html>
  );
}
