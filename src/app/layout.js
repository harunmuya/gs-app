import './globals.css';

import { AuthProvider } from '@/contexts/AuthContext';

export const viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
    themeColor: '#EA580C',
};

export const metadata = {
    title: 'Genuine Sugar Mummies - Find Your Match',
    description: 'Kenya\'s leading dating app for genuine sugar mummy connections. Swipe, match, and connect with verified profiles.',
    manifest: '/manifest.json',
    icons: {
        icon: [
            { url: '/gs-logo.svg', type: 'image/svg+xml' },
        ],
        apple: [
            { url: '/gs-logo.svg' },
        ],
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'Sugar Mummies',
    },
};

export default function RootLayout({ children }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
                <link rel="icon" href="/gs-logo.svg" type="image/svg+xml" />
                <link rel="apple-touch-icon" href="/gs-logo.svg" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="mobile-web-app-capable" content="yes" />
            </head>
            <body className="antialiased" suppressHydrationWarning>
                <AuthProvider>
                    {children}
                </AuthProvider>
                {/* Service Worker Registration */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            if ('serviceWorker' in navigator) {
                                window.addEventListener('load', function() {
                                    navigator.serviceWorker.register('/sw.js')
                                        .then(function(reg) {
                                            console.log('[SW] Registered:', reg.scope);
                                        })
                                        .catch(function(err) {
                                            console.log('[SW] Registration failed:', err);
                                        });
                                });
                            }
                        `,
                    }}
                />
            </body>
        </html>
    );
}
