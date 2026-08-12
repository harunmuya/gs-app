import { NextResponse } from 'next/server';

/**
 * What the current Android shell is, so an old one can say so.
 *
 * The site loads remotely, so the web layer updates itself on every launch and
 * the native shell does not. The two drift, and nothing noticed: a member could
 * be running today's web build inside an APK from months ago and neither side
 * knew. That only matters when something native changes, but when it does the
 * symptom is baffling, because the app looks up to date.
 *
 * The shell reports its versionCode in the user agent. This says what the
 * current one is. The comparison happens in the app.
 *
 * Android cannot add a permission over the air. The manifest is compiled into
 * the APK, so a native change means an install, and that is true of every app
 * on the platform. What Play does for a listed app is download and install it
 * quietly in the background; sideloaded apps have to ask. This is the asking.
 */

export const dynamic = 'force-dynamic';

/*
  Keep in step with android/app/build.gradle. There is no build step that reads
  one from the other, so this is a hand kept pair, which is why it says so
  loudly and why a verification checks the two match.
*/
const CURRENT = {
    versionCode: 2,
    versionName: '1.1',
    // Stable path on purpose. Replacing the file behind it updates every link
    // that has ever been shared, so the download URL never has to change.
    url: '/base-release.apk',
    /*
      What changed, in the words a member would use. Not a changelog of
      commits: somebody deciding whether to spend data on an update wants to
      know what stops working if they do not.
    */
    notes: [
        'Camera, microphone and location now work for calls, going live and nearby matches.',
        'The app asks for each one when you use it, rather than all at once on opening.',
    ],
    /*
      Whether the old shell is still usable. Version 1 cannot reach the camera,
      the microphone or location at all, so calls, going live and nearby are
      broken on it. That is worth interrupting somebody for; a cosmetic change
      would not be.
    */
    required: true,
};

export async function GET() {
    return NextResponse.json(
        { ok: true, android: CURRENT },
        {
            // Short cache. This is polled on launch by every installed app, and
            // it changes a few times a year, but when it does change people
            // should hear about it the same day.
            headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
        },
    );
}
