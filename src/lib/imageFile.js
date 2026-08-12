'use client';

/**
 * Turn a chosen file into a small webp data URL, or say why it could not.
 *
 * The profile photo picker, the verification selfie and the ID upload each had
 * their own copy of this, and all three shared the same hole: an `img.onload`
 * handler with no `onerror` beside it, and a FileReader with no error handler
 * either. When decoding failed, absolutely nothing happened. No error, no
 * status change, no spinner. The member tapped, chose a photo, and the app sat
 * there.
 *
 * That is not a rare path. `accept="image/*"` lets an iPhone hand over a HEIC,
 * which is the default camera format on iOS, and `new Image()` cannot decode
 * HEIC in Chrome or Firefox. So the single most common way to add a photo on
 * the single most common phone failed silently. 56 of 149 real members have no
 * photo at all.
 *
 * createImageBitmap is tried first because it handles formats the Image element
 * will not, and decodes off the main thread. The Image element is the fallback
 * for browsers without it.
 */

/** Anything larger is refused before decoding rather than after. */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result || '');
        // Without this a read failure is simply silence.
        reader.onerror = () => reject(new Error('That file could not be read. Try choosing it again.'));
        reader.readAsDataURL(file);
    });
}

function decodeWithImageElement(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(
            'That picture is in a format this browser cannot open. HEIC photos from an iPhone often do this. '
            + 'Choose Most Compatible in your camera settings, or pick a screenshot of the photo instead.'
        ));
        img.src = dataUrl;
    });
}

function scaled(width, height, max) {
    if (width <= max && height <= max) return { width, height };
    if (width > height) return { width: max, height: Math.round((height * max) / width) };
    return { width: Math.round((width * max) / height), height: max };
}

/**
 * @returns {Promise<string>} a `data:image/webp` URL, small enough to post.
 * @throws {Error} with a message written for the member, never a raw DOM error.
 */
export async function compressImageFile(file, { max = 900, quality = 0.85 } = {}) {
    if (!file) throw new Error('No picture was chosen.');
    if (file.size > MAX_SOURCE_BYTES) {
        throw new Error('That picture is very large. Choose one under 25MB.');
    }

    let source = null;
    let width = 0;
    let height = 0;

    // The path that copes with HEIC and with large files.
    if (typeof createImageBitmap === 'function') {
        try {
            source = await createImageBitmap(file);
            width = source.width;
            height = source.height;
        } catch { source = null; }
    }

    if (!source) {
        const dataUrl = await readAsDataUrl(file);
        if (!dataUrl) throw new Error('That file could not be read. Try choosing it again.');
        const img = await decodeWithImageElement(dataUrl);
        source = img;
        width = img.naturalWidth || img.width;
        height = img.naturalHeight || img.height;
    }

    if (!width || !height) throw new Error('That picture has no readable image in it.');

    const size = scaled(width, height, max);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not prepare the picture. Try another browser.');
    context.drawImage(source, 0, 0, size.width, size.height);
    if (typeof source.close === 'function') source.close();

    /*
      webp is not universal. Older Safari returns a png from toDataURL when it
      does not support the requested type, which still works but is several
      times larger, so the result is checked rather than assumed.
    */
    let out = canvas.toDataURL('image/webp', quality);
    if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/jpeg', quality);
    if (!out || out === 'data:,') throw new Error('The picture could not be prepared. Try a different one.');

    return out;
}
