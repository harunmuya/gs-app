/**
 * robots.txt for the app deployment.
 *
 * The app is not a website and must not be indexed. genuinesugarmummies.co.ke
 * is the site that ranks; this deployment is the product behind it, and every
 * page it exposes to a crawler is either a duplicate of something on the site
 * or a shell that renders nothing to a signed out visitor.
 *
 * What was here before did real harm rather than merely being permissive.
 *
 * It allowed crawling of everything except a list of signed-in paths, so the
 * app's public pages competed with the website's own pages for the same terms.
 * Two properties saying the same thing about sugar mummies in Nairobi split the
 * signal rather than doubling it.
 *
 * Worse, it declared `host` and `sitemap` pointing at genuinesugarmummies.co.ke.
 * A robots.txt on one domain asserting the canonical host of another is not
 * something search engines honour, and the sitemap it advertised listed app
 * routes on the website's domain: /auth/login is a hard 404 there, and /safety,
 * /terms, /privacy and /community-guidelines all 301 elsewhere. So the app was
 * feeding Google a list of the website's URLs that were wrong, from a domain
 * with no authority to describe them.
 *
 * Disallow everything. The header set in next.config.js is what actually
 * prevents indexing, since robots.txt stops crawling but not the indexing of a
 * URL discovered from a link somewhere else.
 */

export default function robots() {
    return {
        rules: [
            {
                userAgent: '*',
                disallow: '/',
            },
        ],
    };
}
