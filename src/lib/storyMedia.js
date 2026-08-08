/**
 * Moving story media into Storage.
 *
 * This lives in its own module so the decision logic can be tested directly
 * rather than re-implemented in a test file, which is how a test ends up
 * asserting against a copy that has drifted from the code it claims to cover.
 * The Storage bucket is passed in, so a test can supply a stub.
 */

export const STORY_MEDIA_LIMIT_BYTES = 8 * 1024 * 1024;

const EXTENSIONS = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
};

export function parseDataUrl(dataUrl) {
    const match = String(dataUrl || '').match(/^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/);
    if (!match) return null;
    return { contentType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

/**
 * Upload story media and return where it landed, or why it was refused.
 *
 * Never returns the input data URL. Every failure path here used to do exactly
 * that, and the caller wrote the result straight into `user_stories.media_url` —
 * so an oversized file or a Storage outage silently put megabytes of base64 in a
 * table column. That is the pattern that had already put 1.8MB of images into
 * `users` and needed a migration to undo.
 *
 * @param bucket  A Supabase Storage bucket handle: { upload, getPublicUrl, remove }.
 * @returns {Promise<{ok: true, url: string, path?: string} | {ok: false, error: string}>}
 */
export async function uploadStoryMedia(bucket, rawUrl, { ownerId, mediaType } = {}) {
    if (!rawUrl) return { ok: true, url: '' };
    // Already hosted somewhere — nothing to move.
    if (!String(rawUrl).startsWith('data:')) return { ok: true, url: String(rawUrl) };

    const parsed = parseDataUrl(rawUrl);
    if (!parsed) return { ok: false, error: 'That file could not be read. Try a different photo or video.' };
    if (parsed.buffer.length > STORY_MEDIA_LIMIT_BYTES) {
        const mb = (parsed.buffer.length / (1024 * 1024)).toFixed(1);
        return { ok: false, error: `That file is ${mb}MB. Stories are limited to 8MB — try a shorter video or a smaller photo.` };
    }

    const ext = EXTENSIONS[parsed.contentType] || (mediaType === 'video' ? 'mp4' : 'webp');
    const cleanOwner = String(ownerId || 'member').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 80);
    const path = `${cleanOwner}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    try {
        const uploaded = await bucket.upload(path, parsed.buffer, {
            contentType: parsed.contentType,
            upsert: false,
        });
        if (uploaded?.error) {
            console.error('[storyMedia] upload failed:', uploaded.error.message);
            return { ok: false, error: 'Your story could not be uploaded right now. Try again in a moment.' };
        }
        const publicUrl = bucket.getPublicUrl(path)?.data?.publicUrl;
        if (!publicUrl) return { ok: false, error: 'Your story could not be uploaded right now. Try again in a moment.' };
        return { ok: true, url: publicUrl, path };
    } catch (err) {
        console.error('[storyMedia] upload threw:', err?.message || err);
        return { ok: false, error: 'Your story could not be uploaded right now. Try again in a moment.' };
    }
}
