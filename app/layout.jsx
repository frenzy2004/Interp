import { StrictMode } from 'react';
import './globals.css';
import { AuthProvider } from '../src/hooks/useAuth';
import { Analytics } from "@vercel/analytics/next";

export const metadata = {
  title: 'Interp — Medical Interpretation',
  description: 'Human-verified AI medical interpretation in emergency departments.',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#0a0a0f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" sizes="192x192" href="/pwa-192x192.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&display=swap" rel="stylesheet" />
      </head>
      <body>
        <StrictMode>
          <AuthProvider>
            <div id="root">
              {children}
            </div>
            <Analytics />
          </AuthProvider>
        </StrictMode>
      </body>
    </html>
  );
}
