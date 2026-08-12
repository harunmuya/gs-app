/**
 * Does the app stay out of search, and out of the website's way?
 *
 * genuinesugarmummies.co.ke is the property that ranks. This deployment is the
 * product behind it. Every page a crawler finds here is either a duplicate of
 * something on the site, competing with it for the same terms, or a shell that
 * renders nothing to a signed out visitor.
 *
 * It was doing considerably worse than merely being crawlable.
 *
 * robots.txt allowed everything except a handful of signed-in paths, and then
 * declared `host` and `sitemap` pointing at genuinesugarmummies.co.ke. A
 * robots.txt on one domain cannot speak for another, and the sitemap it
 * advertised listed app routes on the website's domain: /auth/login is a hard
 * 404 there, and /safety, /terms, /privacy and /community-guidelines all 301
 * elsewhere. The app was feeding Google a list of the website's URLs that was
 * wrong, from a domain with no authority to describe them.
 *
 * Every page also carried a canonical pointing at the website's homepage, which
 * claims that /terms on this deployment and the website's front page are the
 * same document.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

let pass = 0;
let fail = 0;
const check = (label, ok, detail = '') => {
    if (ok) { pass++; console.log(`  ok    ${label}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`  FAIL  ${label}${detail ? `  ${detail}` : ''}`); }
};

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('\nThe app asks not to be crawled');
{
    const robots = strip(readFileSync(join('src', 'app', 'robots.js'), 'utf8'));
    check('everything is disallowed', /disallow: '\/'/.test(robots));
    // Word boundary, because "disallow:" contains "allow:" and the first
    // version of this check failed on the very rule it was verifying.
    check('nothing is explicitly allowed', !/\ballow:/.test(robots),
        'an allow rule beside a blanket disallow is how this drifts back');
    /*
      A robots.txt can only speak for the domain serving it. Declaring the
      website's host and sitemap from here was never honoured, and the sitemap
      it named described the website's URLs incorrectly.
    */
    check('it does not speak for the website domain',
        !/host:/.test(robots) && !/sitemap:/.test(robots));
}

console.log('\nAnd is told not to be indexed, which is the part that works');
{
    /*
      robots.txt only stops a fetch. A URL discovered from a link elsewhere can
      still be indexed, and appears with no snippet precisely because the
      crawler was never allowed to read it. The header travels with the response
      and is what keeps it out.
    */
    const config = readFileSync('next.config.js', 'utf8');
    check('X-Robots-Tag is served on every path', /key: 'X-Robots-Tag'/.test(config));
    const value = (config.match(/key: 'X-Robots-Tag',\s*\n\s*value: '([^']+)'/) || [])[1] || '';
    check('it says noindex', /noindex/.test(value), value);
    check('and nofollow', /nofollow/.test(value));
    // Member photographs are served from here. Image search is the one route by
    // which a face could surface without the profile being indexed at all.
    check('and noimageindex, so member photos stay out of image search',
        /noimageindex/.test(value));

    const layout = readFileSync(join('src', 'app', 'layout.js'), 'utf8');
    check('the root metadata agrees', /index: false/.test(strip(layout)),
        'two independent statements, so a refactor dropping one is not silent');
}

console.log('\nIt makes no claim about the website');
{
    const layout = strip(readFileSync(join('src', 'app', 'layout.js'), 'utf8'));
    check('no canonical pointing at the website', !/canonical:/.test(layout),
        'every page claimed to be the website homepage');
    check('the app publishes no sitemap', !existsSync(join('src', 'app', 'sitemap.js')),
        'it listed website URLs that 404 or redirect');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
