import './globals.css';

import { AuthProvider } from '@/contexts/AuthContext';
import ClientProviders from '@/components/ClientProviders';

export const viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
    viewportFit: 'cover',
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
        { media: '(prefers-color-scheme: dark)', color: '#0F0F14' },
    ],
};

export const metadata = {
    title: 'Genuine Sugar Mummies - Kenya\'s #1 Dating App | Find Your Match',
    description: 'Join Kenya\'s most trusted dating platform. Connect with genuine sugar mummies and sugar daddies. Verified profiles, secure messaging, and real connections. Download the app today!',
    keywords: 'sugar mummy kenya, dating app kenya, sugar mummy dating, genuine sugar mummies, nairobi dating, kenya dating app, sugar daddy kenya, real connections, verified profiles',
    authors: [{ name: 'Genuine Sugar Mummies', url: 'https://genuinesugarmummies.co.ke' }],
    manifest: '/manifest.json',
    metadataBase: new URL('https://genuinesugarmummies.co.ke'),
    alternates: {
        canonical: 'https://genuinesugarmummies.co.ke',
    },
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
        title: 'Genuine Sugar Mummies - Kenya\'s #1 Dating App',
        description: 'Join Kenya\'s most trusted dating platform. Connect with genuine sugar mummies and sugar daddies. Verified profiles, secure messaging, and real connections.',
        images: [
            {
                url: '/gs-logo.png',
                width: 500,
                height: 500,
                alt: 'Genuine Sugar Mummies - Kenya\'s #1 Dating App',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Genuine Sugar Mummies - Kenya\'s #1 Dating App',
        description: 'Join Kenya\'s most trusted dating platform. Verified profiles, secure messaging, real connections.',
        images: ['/gs-logo.png'],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },
    verification: {
        google: '',
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
                            "description": "Kenya's #1 dating app for genuine sugar mummy and sugar daddy connections. Verified profiles, secure messaging, and real connections.",
                            "applicationCategory": "SocialNetworkingApplication",
                            "operatingSystem": "Any",
                            "browserRequirements": "Requires JavaScript",
                            "softwareVersion": "4.0",
                            "offers": {
                                "@type": "Offer",
                                "price": "0",
                                "priceCurrency": "KES"
                            },
                            "author": {
                                "@type": "Organization",
                                "name": "Genuine Sugar Mummies",
                                "url": "https://genuinesugarmummies.co.ke"
                            },
                            "aggregateRating": {
                                "@type": "AggregateRating",
                                "ratingValue": "4.5",
                                "ratingCount": "1200",
                                "bestRating": "5"
                            }
                        }),
                    }}
                />
                {/* Dark Mode Initialization — runs before paint to prevent flash */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            (function(){
                                try {
                                    var d = localStorage.getItem('gs_dark_mode');
                                    if (d === 'true') {
                                        document.documentElement.classList.add('dark');
                                    } else if (d === null && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                                        // Don't auto-enable dark — default is white/light
                                    }
                                } catch(e){}
                            })();
                        `,
                    }}
                />
            </head>
            <body className="antialiased" suppressHydrationWarning>
                <AuthProvider>
                    <ClientProviders>
                        {children}
                    </ClientProviders>
                </AuthProvider>
                {/* Service Worker Cleanup — unregister any lingering SW */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            if ('serviceWorker' in navigator) {
                                navigator.serviceWorker.getRegistrations().then(function(regs) {
                                    for (var r of regs) { r.unregister(); }
                                });
                            }
                        `,
                    }}
                />
            </body>
        </html>
    );
}
