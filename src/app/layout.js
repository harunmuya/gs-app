import './globals.css';

import { AuthProvider } from '@/contexts/AuthContext';
import NotificationManager from '@/components/NotificationManager';
import PrivacyProtection from '@/components/PrivacyProtection';
import ConnectionStatus from '@/components/ConnectionStatus';

export const viewport = {
    width: 'device-width',
    initialScale: 1,
    // Pinch-zoom must stay available. `maximumScale: 1` with `userScalable: false`
    // blocks it, which fails WCAG 2.1 SC 1.4.4 (Resize Text) and is a real problem
    // for users reading profiles on a phone. Allowing zoom costs nothing here —
    // the layout is responsive and does not rely on a locked viewport.
    maximumScale: 5,
    userScalable: true,
    viewportFit: 'cover',
    themeColor: '#C21E56',
};

export const metadata = {
    title: 'Genuine Sugar Mummies - Find Your Perfect Match',
    description: 'The #1 premium dating app for genuine sugar mummy connections. Swipe, match, and connect with verified profiles worldwide. Safe, secure, and real.',
    keywords: ['sugar mummy', 'dating app', 'connections', 'match', 'verified profiles', 'genuine sugar mummies'],
    authors: [{ name: 'Genuine Sugar Mummies' }],
    creator: 'Genuine Sugar Mummies',
    metadataBase: new URL('https://genuinesugarmummies.co.ke'),
    /*
      Nothing here is indexed, and it says so in its own metadata as well as in
      the X-Robots-Tag header set in next.config.js. Two independent statements
      of the same thing, because one of them being dropped by a refactor should
      not quietly put member photographs into image search.

      The canonical that used to sit here is gone. It pointed every page on this
      deployment at the website's homepage, which is wrong twice over: a canonical
      is a claim that two URLs are the same page, and /terms here is not the
      website's front page. Google also treats noindex and canonical together as
      a contradiction, since one says do not index this and the other says index
      that instead. The website ranks on its own pages; this one simply stays out
      of the way.
    */
    robots: {
        index: false,
        follow: false,
        nocache: true,
        googleBot: { index: false, follow: false },
    },
    openGraph: {
        title: 'Genuine Sugar Mummies - Find Your Perfect Match',
        description: 'The premium dating app for genuine sugar mummy connections. Swipe, match, and connect with verified profiles.',
        url: 'https://genuinesugarmummies.co.ke',
        siteName: 'Genuine Sugar Mummies',
        locale: 'en_US',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Genuine Sugar Mummies',
        description: 'Premium dating app for genuine connections',
    },
    manifest: '/manifest.json',
    icons: {
        icon: '/gs-logo.png',
        apple: '/gs-logo.png',
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'GS Mummies',
    },
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Outfit:wght@300;400;500;600;700;800;900&display=swap"
                    rel="stylesheet"
                />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="mobile-web-app-capable" content="yes" />
            </head>
            <body className="antialiased" suppressHydrationWarning>
                <AuthProvider>
                    <ConnectionStatus />
                    <NotificationManager />
                    <PrivacyProtection />
                    {children}
                </AuthProvider>

                {/* Register Service Worker */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            if ('serviceWorker' in navigator) {
                                // Never run the worker on a dev host. It caches
                                // /_next/static/ cache-first, which is right in
                                // production where filenames are content-hashed, but
                                // in development Next reuses chunk names — so the
                                // worker serves stale JavaScript and code changes
                                // silently do not appear. Any worker left over from a
                                // previous session is removed too.
                                var isDevHost = ['localhost', '127.0.0.1', '::1'].indexOf(location.hostname) !== -1;
                                if (isDevHost) {
                                    navigator.serviceWorker.getRegistrations?.()
                                        .then((regs) => regs.forEach((reg) => reg.unregister?.()))
                                        .catch(() => {});
                                } else {
                                    window.addEventListener('load', () => {
                                        navigator.serviceWorker.getRegistrations?.().then((regs) => regs.forEach((reg) => reg.update?.())).catch(() => {});
                                        navigator.serviceWorker.register('/sw.js?v=20260808-v14', { updateViaCache: 'none' }).catch(() => {});
                                    });
                                }
                            }
                        `,
                    }}
                />
            </body>
        </html>
    );
}
