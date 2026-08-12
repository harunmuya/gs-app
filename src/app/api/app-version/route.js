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
  No update is advertised, on purpose.

  The APK in public/downloads is com.genuinesugarmummies.global, labelled GS
  Global. That is the V2 app, built from the separate genuinesugarmummies.com
  project, and it loads https://genuinesugarmummies-com-v2.vercel.app. It is a
  different application that shows a different website.

  So the update prompt was offering to install V2 over V1. Somebody who
  accepted would have ended up in the other product, wondering where their
  account went. A prompt that does nothing, which is what the broken download
  amounted to, was accidentally the safer failure.

  This stays null until a real V1 APK exists at that path. Set versionCode,
  versionName and url together when it does, and keep versionCode in step with
  android/app/build.gradle. verify-apk-identity checks the APK actually there
  against what this project builds, and will refuse a mismatch.
*/
const CURRENT = null;

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
