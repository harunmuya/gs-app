/**
 * Do device permissions work in the installed app?
 *
 * The web build asks for camera, microphone and location the right way, behind
 * a rationale sheet. None of that reached the Android app, for two reasons that
 * compounded each other.
 *
 * MainActivity requested everything in onCreate. A wall of system dialogs
 * before the member has seen a screen is the reliable way to be denied, and on
 * Android two dismissals make that denial permanent. After that the rationale
 * sheets could ask all they liked and no dialog would ever appear.
 *
 * And nothing answered the WebView. The app loads the site from a remote URL,
 * so getUserMedia and navigator.geolocation arrive at the WebView rather than
 * at Android. Unless the host activity answers, the WebView denies silently:
 * the page sees a rejected promise, the member sees a camera that will not turn
 * on, and Android never records a denial because it was never asked.
 *
 * Nothing here compiles Java, so this checks the shape rather than the
 * behaviour. That is still worth having: both faults were visible in the file.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

let pass = 0;
let fail = 0;
const check = (label, ok, detail = '') => {
    if (ok) { pass++; console.log(`  ok    ${label}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`  FAIL  ${label}${detail ? `  ${detail}` : ''}`); }
};

const ACTIVITY = join('android', 'app', 'src', 'main', 'java', 'ke', 'co', 'genuinesugarmummies', 'app', 'MainActivity.java');
const MANIFEST = join('android', 'app', 'src', 'main', 'AndroidManifest.xml');

if (!existsSync(ACTIVITY) || !existsSync(MANIFEST)) {
    console.log('\nNo Android project in this checkout, nothing to check.');
    process.exitCode = 0;
} else {
    const activity = readFileSync(ACTIVITY, 'utf8');
    const manifest = readFileSync(MANIFEST, 'utf8');
    const code = activity.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    console.log('\nNothing is demanded at launch');
    check('onCreate does not request permissions',
        !/requestDevicePermissions\(\)/.test(code),
        'the rationale sheets in the web layer do the asking');
    check('no permission list is built on startup',
        !/addPermissionIfNeeded/.test(code));

    console.log('\nThe WebView gets an answer');
    check('camera and microphone requests are handled', /onPermissionRequest/.test(code),
        'otherwise getUserMedia is denied in silence');
    check('location requests are handled', /onGeolocationPermissionsShowPrompt/.test(code));
    check('a granted permission is passed back to the page', /request\.grant\(/.test(code));
    // The call sits on pendingMediaRequest, so match the method rather than a
    // guessed receiver name.
    check('a refusal is passed back too', /\.deny\(\)/.test(code),
        'a page waiting forever is worse than a no');
    check('the geolocation callback is always answered', /pendingGeolocationCallback\.invoke\(/.test(code));
    check('Capacitor keeps its own chrome client behaviour',
        /extends BridgeActivity/.test(code) && /new BridgeWebChromeClient\(getBridge\(\)\)/.test(code),
        'subclassed rather than replaced, so the file chooser still works');

    console.log('\nA partial grant is not treated as success');
    // Camera without microphone produces a call nobody can hear, which is
    // harder to diagnose than an outright refusal.
    check('media needs every permission it asked for', /allGranted = false/.test(code));
    // Coarse location alone is a real answer, so any grant counts there.
    check('location accepts coarse alone', /anyGranted = true/.test(code));

    console.log('\nThe manifest asks for what the app uses, and no more');
    const declared = [...manifest.matchAll(/android\.permission\.([A-Z_]+)/g)].map((m) => m[1]);
    for (const needed of ['CAMERA', 'RECORD_AUDIO', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'POST_NOTIFICATIONS']) {
        check(`${needed} is declared`, declared.includes(needed));
    }
    for (const unused of ['READ_CONTACTS', 'CALL_PHONE']) {
        check(`${unused} is not declared`, !declared.includes(unused),
            'dangerous, unused, and reviewed closely by Play');
    }

    console.log('\nThe documented contract matches the manifest');
    const contract = readFileSync(join('src', 'lib', 'apiContract.js'), 'utf8');
    check('no permission is documented that the app cannot request',
        !/READ_CONTACTS|CALL_PHONE/.test(contract));

    console.log('\nAn update can actually install over the old app');
    {
        /*
          Android refuses an install whose versionCode is not higher than the
          one on the device. This sat at 1 from the first build, so any rebuild
          would have failed to update anybody: they would see "App not
          installed" and be told to uninstall first, losing their local state.
          That is the exact opposite of shipping an update.
        */
        const gradle = readFileSync(join('android', 'app', 'build.gradle'), 'utf8');
        const versionCode = Number((gradle.match(/versionCode\s+(\d+)/) || [])[1] || 0);
        check('versionCode has been moved off the default', versionCode > 1,
            `currently ${versionCode}`);

        /*
          The web layer reaching installed users without a new APK depends
          entirely on this. If server.url were ever dropped, the app would load
          a bundle frozen at build time and every fix would need a release.
        */
        const capacitor = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
        check('the app loads the site remotely', Boolean(capacitor.server?.url),
            capacitor.server?.url || 'no server.url, every fix would need a new APK');
        check('it points at the production deployment',
            String(capacitor.server?.url || '').startsWith('https://'),
            capacitor.server?.url || '');

        /*
          The version numbers are compared in verify-apk-identity instead, which
          reads them from the published APK with aapt rather than from a config
          file. Two scripts checking the same pair meant fixing the same comment
          reading bug twice, and only one of them was looking at reality.
        */
        const route = readFileSync(join('src', 'app', 'api', 'app-version', 'route.js'), 'utf8');

        // An update that downloads and then cannot install reads as a failure.
        check('the app may install its own update',
            /REQUEST_INSTALL_PACKAGES/.test(manifest));

        const notice = readFileSync(join('src', 'components', 'AppUpdateNotice.js'), 'utf8');
        check('the shell reports its version to the web layer',
            /GSApp\\\/\(\\d\+\)/.test(notice) && /GSApp\/" \+ versionCode/.test(activity),
            'the user agent is the one channel that needs no plugin');
        // A browser is null, an old shell is 0. Testing falsiness would skip
        // every shell already installed, which is the group that needs telling.
        check('the notice is silent in a browser but not in an old shell',
            /if \(installed === null\) return undefined;/.test(notice)
            && /window\.Capacitor \? 0 : null/.test(notice));
        check('a dismissal is remembered per version', /DISMISS_KEY/.test(notice));
        /*
          The in app download must be off host.

          A WebView cannot download, so a same host link does nothing at all.
          Capacitor hands an off host link to the system browser, which can.
          This was briefly switched to a same host path on the reasoning that
          version 2 adds a DownloadListener, which is circular: version 2 is
          what the button downloads, so nobody tapping it has the listener yet.
          It can only move on host once no shell without one is left.
        */
        check('the in app download is off host',
            /https:\/\/genuinesugarmummies\.co\.ke\/app\//.test(route),
            'a same host link cannot download inside a WebView');
        check('the shell accepts downloads from version 2 on',
            /setDownloadListener/.test(code));
    }

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exitCode = fail ? 1 : 0;
}
