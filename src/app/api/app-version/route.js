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
  is a real V1 build now: ke.co.genuinesugarmummies.mobile, signed, loading this
  deployment.
*/
const CURRENT = {
    versionCode: 5,
    versionName: '1.4',
    /*
      Served from the VPS, on a different host from the app, and it has to stay
      that way for now.

      An Android WebView cannot download. A link on the same host as the app is
      handled inside the WebView, which drops it: no download, no error, a
      button that looks dead. Capacitor hands an off host link to the system
      browser instead, which can download it.

      Version 2 adds a DownloadListener that fixes this properly, so a same host
      link would work from an install of version 2 onward. That reasoning is
      circular and this was briefly switched back on the strength of it: version
      2 is the thing being downloaded, so nobody tapping this button has the
      listener yet. It goes back off host, and can only move once no shell
      without a DownloadListener is left in the wild.

      /base-release.apk on this deployment serves the same file, byte for byte,
      and is the link to share outside the app where a normal browser handles it.
      That had quietly stopped being true - public/downloads held an August build
      while the VPS served a newer one - so the two are re-synced here. Copy the
      APK into public/downloads in the same commit that moves these numbers, or
      the claim rots again.
    */
    url: 'https://genuinesugarmummies.co.ke/app/genuine-sugar-mummies.apk',
    /*
      What changed, in the words a member would use, and short enough to read
      above a set of instructions. Somebody deciding whether to spend data and
      five minutes on this wants to know what stops working if they do not.
    */
    notes: [
        'This version installs under a new package name, so it no longer clashes with the very first build, which was signed with a key we no longer have. It installs alongside whatever you already have rather than replacing it - once it is working, remove the old icon.',
    ],
    /*
      Not required. Version 2 already carries the permission bridge, and the
      address baked into it still reaches this same deployment, so nothing is
      broken on it - what changes is the app's own domain and its appearance.

      Version 2 was required because without that bridge the camera, the
      microphone and location were unreachable, which is a different situation
      from this one. Saying "required" when it is not teaches people to dismiss
      the prompt, and then it does not work the time it matters.
    */
    required: false,
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
