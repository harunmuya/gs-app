/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'genuinesugarmummies.co.ke',
      },
      {
        protocol: 'https',
        hostname: '*.wp.com',
      },
      {
        protocol: 'https',
        hostname: 'secure.gravatar.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'rmsvyhfpiytcffjkozje.supabase.co',
      },
    ],
  },

  async redirects() {
    return [
      {
        source: '/seed-photos/:slug(seed-m-.*)',
        destination: '/seed/sugar-dads/photo_10_2026-06-25_14-22-09.jpg',
        permanent: false,
      },
      {
        source: '/seed-photos/:slug*',
        destination: '/seed/sugarmums/photo_10_2026-06-24_14-00-45.jpg',
        permanent: false,
      },
    ];
  },

  // Security headers
  async headers() {
    if (process.env.NODE_ENV === 'development') {
      return [];
    }
    return [
      {
        // Seed photography, gift art, and icons are immutable: filenames are
        // content-specific and the files are replaced by name, never edited.
        // Without this they are served with a revalidating cache policy, so every
        // card view costs a request against ~51 MB of assets.
        source: '/:dir(seed|gifts|icons)/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        /*
          Keep the app out of search entirely.

          genuinesugarmummies.co.ke is the property that ranks. This deployment
          is the product behind it, and anything a crawler finds here is either
          a duplicate of a page on the site, competing with it for the same
          terms, or a shell that renders nothing to a signed out visitor.

          robots.txt is not enough on its own. It asks a crawler not to fetch a
          URL, which means a URL discovered from a link elsewhere can still be
          indexed, listed with no snippet because the crawler was never allowed
          to read it. X-Robots-Tag is served with the response itself and is
          what actually keeps it out of the index.

          noimageindex matters here specifically. Member photographs are served
          from this deployment, and image search is the one route by which a
          member's face could surface publicly without their profile ever being
          indexed at all.
        */
        source: '/(.*)',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive, noimageindex',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=(self), clipboard-read=(self), clipboard-write=(self), display-capture=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com https://accounts.google.com https://apis.google.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://genuinesugarmummies.co.ke https://rmsvyhfpiytcffjkozje.supabase.co wss://rmsvyhfpiytcffjkozje.supabase.co https://accounts.google.com https://oauth2.googleapis.com https://fonts.googleapis.com https://fonts.gstatic.com https://lh3.googleusercontent.com https://secure.gravatar.com https://*.wp.com https://ipapi.co https://t.me https://gs-ai-ten.vercel.app",
              "frame-src https://accounts.google.com https://gs-ai-ten.vercel.app",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self' https://accounts.google.com",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
