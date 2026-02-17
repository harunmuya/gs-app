import './globals.css';

import { AuthProvider } from '@/contexts/AuthContext';

export const viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
    viewportFit: 'cover',
    themeColor: '#EA580C',
};

export const metadata = {
    title: 'Genuine Sugar Mummies - Find Your Match in Kenya',
    description: 'Kenya\'s #1 dating app for genuine sugar mummy connections. Swipe, match, and connect with verified profiles. Safe, secure, and real.',
    keywords: 'sugar mummy, dating, kenya, sugar mummy dating, genuine sugar mummies, dating app, nairobi dating',
    authors: [{ name: 'GS Admin' }],
    manifest: '/manifest.json',
    metadataBase: new URL('https://genuinesugarmummies.co.ke'),
    icons: {
        icon: [
            { url: '/gs-logo.png', type: 'image/png', sizes: '500x500' },
            { url: '/gs-logo.svg', type: 'image/svg+xml' },
        ],
        apple: [
            { url: '/gs-logo.png', sizes: '500x500' },
        ],
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'GS App',
    },
    openGraph: {
        type: 'website',
        locale: 'en_KE',
        url: 'https://genuinesugarmummies.co.ke',
        siteName: 'Genuine Sugar Mummies',
        title: 'Genuine Sugar Mummies - Find Your Match in Kenya',
        description: 'Kenya\'s #1 dating app for genuine sugar mummy connections. Swipe, match, and connect with verified profiles.',
        images: [
            {
                url: '/gs-logo.png',
                width: 500,
                height: 500,
                alt: 'Genuine Sugar Mummies Logo',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Genuine Sugar Mummies - Find Your Match',
        description: 'Kenya\'s #1 dating app for genuine sugar mummy connections.',
        images: ['/gs-logo.png'],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
        },
    },
};

export default function RootLayout({ children }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
                <link rel="icon" href="/gs-logo.png" type="image/png" />
                <link rel="apple-touch-icon" href="/gs-logo.png" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="mobile-web-app-capable" content="yes" />
                <meta name="format-detection" content="telephone=no" />
                {/* JSON-LD Structured Data */}
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "WebApplication",
                            "name": "Genuine Sugar Mummies",
                            "url": "https://genuinesugarmummies.co.ke",
                            "description": "Kenya's #1 dating app for genuine sugar mummy connections",
                            "applicationCategory": "SocialNetworkingApplication",
                            "operatingSystem": "Any",
                            "offers": {
                                "@type": "Offer",
                                "price": "0",
                                "priceCurrency": "KES"
                            },
                            "author": {
                                "@type": "Organization",
                                "name": "Genuine Sugar Mummies"
                            }
                        }),
                    }}
                />
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
