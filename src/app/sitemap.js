/**
 * sitemap.xml
 *
 * Only genuinely public, indexable pages are listed. Member profiles are
 * deliberately excluded: they are behind authentication, they change constantly,
 * and a large proportion are seeded profiles that should not be presented to
 * search engines as real people.
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://genuinesugarmummies.co.ke';

// Note: /packages is NOT listed. It lives inside the (main) route group and is
// therefore behind AuthGuard, so an anonymous crawler gets nothing. A public
// pricing page would be a real SEO asset — moving it outside the auth gate is
// worth doing, and then it belongs here at priority 0.8.
const PAGES = [
    { path: '/', changeFrequency: 'daily', priority: 1 },
    { path: '/auth/login', changeFrequency: 'monthly', priority: 0.6 },
    { path: '/safety', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/community-guidelines', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/contact', changeFrequency: 'monthly', priority: 0.4 },
];

export default function sitemap() {
    const lastModified = new Date();
    return PAGES.map(({ path, changeFrequency, priority }) => ({
        url: `${SITE}${path}`,
        lastModified,
        changeFrequency,
        priority,
    }));
}
