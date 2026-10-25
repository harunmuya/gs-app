'use client';

/*
  The wordmark, in the two inks the site publishes.

  The art is now cut from the same files the website uses as its custom logo,
  so the app and the site read as one brand. Two things changed with it:

  - The old file was 300x39 and the component assumed a 4.8 ratio from it. The
    real wordmark is close to 13:1, so a width derived from the height would
    overflow a phone header. It is sized by maxHeight and maxWidth with width
    and height left auto instead, which lets whichever limit binds first set
    the size while the ratio holds.

  - The wordmark is solid black and vanishes on the dark theme, so the white
    cut ships beside it and the theme picks one. The swap is CSS rather than
    state because the theme is an attribute on <html>: reading it in JS would
    render the wrong ink first and flip after hydration.
*/
/*
  `maxWidth` defaults to 82vw, which suits a logo standing alone on a sign-in
  screen. In a header it has to be the space actually left over beside the
  icons, not a share of the whole viewport: 82vw plus two 36px buttons does not
  fit a 375px phone, and the row wrapped. The caller knows which case it is in,
  so the caller says.
*/
export default function Logo({ size = 32, className = '', maxWidth = '82vw' }) {
    const common = {
        alt: 'Genuine Sugar Mummies',
        width: 718,
        height: 56,
        decoding: 'async',
        // In the header on first paint, so not a candidate for lazy loading.
        loading: 'eager',
        style: { maxHeight: size, maxWidth, width: 'auto', height: 'auto' },
    };

    return (
        <>
            <img
                {...common}
                src="/gs-logo.png"
                className={`gs-logo-ink-dark shrink-0 object-contain ${className}`}
            />
            <img
                {...common}
                src="/gs-logo-white.png"
                className={`gs-logo-ink-light shrink-0 object-contain ${className}`}
            />
        </>
    );
}
