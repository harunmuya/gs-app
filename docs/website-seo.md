# genuinesugarmummies.co.ke SEO

The website is WordPress on the VPS and is not in this repository, so changes to
it leave no trace here unless they are written down. This is that record.

Audited and changed 13 August 2026.

## What was wrong

**Every page title was bare.** Yoast's templates were `%%title%%` for posts and
pages and `%%term_title%%` for categories, with no site name appended. Google
renders roughly 60 characters and these were using a fraction of it:

| Page | Before | After |
|---|---|---|
| Home | `Genuine Sugar Mummies Kenya` (27) | `Genuine Sugar Mummies Kenya \| Verified Sugar Mummy Dating` (57) |
| `/register/` | `Register` (8) | `Register - Genuine Sugar Mummies Kenya` (38) |
| `/download-gs-app/` | `Download GS App` (15) | `Download GS App - Genuine Sugar Mummies Kenya` (45) |
| `/category/sugar-boys/` | `Sugar Boys` (10) | `Sugar Boys - Genuine Sugar Mummies Kenya` (40) |

An eight character title is the single largest on-page ranking signal left
almost entirely unused, and it was that way across 488 posts, 31 pages and 7
categories.

**`metadesc-page` was set to `%%pagenumber%%`.** Any page without a hand written
description got a meta description consisting of a digit, or nothing.

Both were changed through `wp option update wpseo_titles`. The previous value is
saved at `/root/wpseo_titles.backup-20260813.json`.

## What was already right

Worth recording so it is not re-investigated:

- Indexable. `robots.txt` allows crawling, and pages carry
  `index, follow, max-image-preview:large`.
- Sitemaps present and populated: 488 posts, 31 pages, 7 categories, 73 tags.
- Canonicalisation correct. `http`, `www`, and `http://www` all 301 to
  `https://genuinesugarmummies.co.ke`.
- Server response is fast. TTFB about 105ms.
- Images are handled properly: every image on the homepage carries alt text,
  most are lazy loaded and carry width and height, so layout shift is limited.
- Content is not thin. Profile posts run 374 to 1299 words.
- Structured data is complete: Article, BreadcrumbList, Organization, Person,
  ImageObject.
- All 7 categories are linked from the homepage with descriptive anchors.

## Known weaknesses, not yet addressed

**Page weight.** The homepage is 350KB of HTML, of which 112KB is CSS the theme
inlines directly, plus 6 render blocking stylesheets on top. LiteSpeed's
minification and combination are all switched off, but they act on enqueued
files rather than theme inlined styles, so turning them on would not touch the
112KB. Fixing this properly means changing how the Boombox theme emits CSS,
which risks visible breakage on a live site and was not attempted.

**No WebP or AVIF.** Every image is JPEG or PNG. LiteSpeed can convert, but its
image optimisation requires a QUIC.cloud account.

**Content age.** Many profile posts are three years old. Freshness is a ranking
factor for a listings site, and republishing or updating the strongest posts
would help more than any technical change left on this list.

## Categories, for reference

The core term is `sugarmummies`, unhyphenated. `/category/sugar-mummies/`,
`/sugar-mummies/` and `/category/sugar-mummy/` all 404, so any link built to
those forms is wasted.

```
/category/sugar-boys/
/category/sugar-daddies/
/category/sugar-mummy-dating-testimonials/
/category/sugarmummies/
/category/sugarmummies-in-kisumu/
/category/sugarmummies-in-mombasa/
/category/sugarmummies-in-nairobi/
```

## After any change

WordPress here sits behind four caches and an edit is invisible until all are
cleared:

```
systemctl restart php8.2-fpm
wp cache flush --path=/var/www/genuinesugarmummies.co.ke --allow-root
rm -rf /var/cache/nginx/fastcgi/*
systemctl reload nginx
```
