/**
 * robots.txt
 *
 * Signed-in areas are disallowed. They sit behind AuthGuard, but that guard runs
 * on the client — a crawler still receives the page shell, and indexing member
 * URLs would leak profile ids into search results and waste crawl budget on pages
 * that render nothing useful to an anonymous visitor.
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://genuinesugarmummies.co.ke';

export default function robots() {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: [
                    '/api/',
                    '/admin',
                    '/auth/',
                    '/profile',
                    '/wallet',
                    '/messages',
                    '/matches',
                    '/packages',
                    '/alerts',
                    '/calls/',
                    '/live/',
                    '/discover/',
                    '/members/',
                ],
            },
        ],
        sitemap: `${SITE}/sitemap.xml`,
        host: SITE,
    };
}
