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
/*
  Keep versionCode in step with android/app/build.gradle. Nothing in the build
  reads one from the other, so verify-apk-identity compares both against the
  APK actually sitting in public/downloads and refuses a mismatch.

  This was null for a while, because the APK in that folder was the V2 app and
  offering it as an update to V1 would have put people in the other product. It
  is a real V1 build now: ke.co.genuinesugarmummies.app, signed, loading this
  deployment.
*/
const CURRENT = {
    versionCode: 2,
    versionName: '1.1',
    /*
      Served from this deployment. A same host link cannot download inside a
      WebView, which is why the button appeared dead, so version 2 carries a
      DownloadListener that hands the URL to the system download manager. Every
      install from here has that listener, so the plain path is right.
    */
    url: '/base-release.apk',
    notes: [
        'Camera, microphone and location now work for calls, going live and nearby matches.',
        'The app asks for each one when you use it, rather than all at once on opening.',
    ],
    /*
      Required, because a shell without the permission bridge cannot reach the
      camera, the microphone or location at all. Calls, going live and nearby
      are broken on it.
    */
    required: true,
};

export async function GET() {
    // android: null means "nothing to offer". The app treats an absent
    // versionCode as no update and stays quiet, which is what should happen
    // while the only APK available belongs to another application.
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
