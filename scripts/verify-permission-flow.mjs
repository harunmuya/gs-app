/**
 * Does every OS permission get explained before it is asked for?
 *
 * A denial at the system dialog is close to permanent. The browser stops asking,
 * and on Android 13 POST_NOTIFICATIONS cannot be requested a second time, so the
 * only route back is the device settings screen. That makes the rationale the
 * whole game: a member who taps Deny on a bare prompt has broken Nearby, calls,
 * Go Live or alerts for good, and did it in the first fifteen seconds of using
 * the app, before anything had explained what was being asked for.
 *
 * Notifications were the last one still going straight to the OS.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let pass = 0;
let fail = 0;
const check = (label, ok, detail = '') => {
    if (ok) { pass++; console.log(`  ok    ${label}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`  FAIL  ${label}${detail ? `  ${detail}` : ''}`); }
};

function walk(dir, out = []) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.(js|jsx)$/.test(entry)) out.push(full);
    }
    return out;
}

const read = (f) => readFileSync(f, 'utf8');
const files = walk('src');
const lib = read(join('src', 'lib', 'permissions.js'));
const sheet = read(join('src', 'components', 'PermissionSheet.js'));
const manager = read(join('src', 'components', 'NotificationManager.js'));

console.log('\nNothing asks the OS directly');

/*
  Only lib/permissions may reach the raw APIs cold. Everything else has to sit
  behind either the rationale sheet or an explicit tap on a control that says
  what it is about to do.

  The allowlist below is the second kind, and each entry earns its place:

    calls/[id]        reopens a stream it has already been granted, behind the
                      sheet, after the member pressed Retry
    live/page         checks permissionState and shows the sheet first
    discover/page     same, before Nearby runs
    VoiceRecorder     fires from press-and-hold on the mic button, and names the
    members/[id]      recovery step if the OS refuses
    ProfileCompletion tap on "Detect my location"
    profile/page      tap on "Detect my location"
    auth/login        tap on "Use my location" during signup

  A screen not on this list that touches the API is asking cold, which is the
  thing this file exists to prevent.
*/
const BEHIND_A_TAP = [
    join('calls', '[id]'), join('live', 'page.js'), join('discover', 'page.js'),
    'VoiceRecorder.js', join('members', '[id]'), 'ProfileCompletionModal.js',
    join('profile', 'page.js'), join('login', 'page.js'),
    // The settings toggle. The member has just switched notifications on.
    'NotificationManager.js',
    // Reads a fix only after permissionState says granted, or after the sheet
    // has asked. The six named checks below hold it to that.
    'LocationPermissionManager.js',
];

const RAW = [
    ['Notification.requestPermission', /Notification\.requestPermission\s*\(/],
    ['getUserMedia', /getUserMedia\s*\(/],
    ['getCurrentPosition', /getCurrentPosition\s*\(/],
    ['LocalNotifications.requestPermissions', /LocalNotifications\.requestPermissions\s*\(/],
];
for (const [label, pattern] of RAW) {
    const unexpected = files
        .filter((f) => pattern.test(read(f)))
        .filter((f) => !f.endsWith(join('lib', 'permissions.js')))
        .filter((f) => !BEHIND_A_TAP.some((allowed) => f.includes(allowed)));
    check(`${label} is never called cold`,
        unexpected.length === 0,
        unexpected.length ? unexpected.join(', ') : '');
}

// The manager mounted in the shell is the one that used to ask cold, so it is
// checked by name rather than left to the allowlist.
{
    const location = read(join('src', 'components', 'LocationPermissionManager.js'));
    check('the location manager checks state before asking', /await permissionState\('location'\)/.test(location));
    check('it shows the rationale rather than the OS dialog', /<PermissionSheet\s+permission="location"/.test(location));
    check('a blocked grant falls back to the IP estimate', /if \(state === 'denied'\)[\s\S]{0,120}useIpFallback\(\)/.test(location));
    check('a decline still yields a location', /onClose=\{\(\) => \{[\s\S]{0,300}useIpFallback\(\)/.test(location));
    check('it honours the accuracy the member chose', /enableHighAccuracy: precise/.test(location));
    check('it does not re-read a fix the sheet already took', /if \(result\?\.ok && result\.coords\) \{ storeCoords/.test(location));
}

console.log('\nNotifications');

check('the manager renders the rationale sheet', /<PermissionSheet\s+permission="notifications"/.test(manager));
check('it no longer requests on mount',
    !/nativeNotifications\.requestPermissions\(\)\.catch/.test(manager),
    'the old cold path is gone');
check('it waits before asking', /const ASK_AFTER_MS = 15_000;/.test(manager));
check('a previous decline is respected', /wasDismissed\('notifications'\)/.test(manager));
check('a blocked permission is not re-asked', /if \(state === 'denied'\)/.test(manager));
check('it never asks during a call or a broadcast',
    /const NEVER_ASK_ON = \[\/\^\\\/calls\\\/\/, \/\^\\\/live\\\/\/\];/.test(manager));

// The route guard has to work, not merely exist.
{
    const line = manager.match(/const NEVER_ASK_ON = (\[.*\]);/);
    let behaves = false;
    if (line) {
        // eslint-disable-next-line no-eval
        const patterns = eval(line[1]);
        const skipped = ['/calls/abc', '/live/xyz'].every((p) => patterns.some((r) => r.test(p)));
        const allowed = ['/discover', '/matches', '/messages'].every((p) => !patterns.some((r) => r.test(p)));
        behaves = skipped && allowed;
    }
    check('the guard matches call and live routes only', behaves);
}

console.log('\nThe native shell is handled');

check('requestNotifications tries the native plugin first',
    /export async function requestNotifications\(\)[\s\S]{0,400}Capacitor\.isNativePlatform/.test(lib),
    'Notification.requestPermission does not reach POST_NOTIFICATIONS in a WebView');
check('permissionState reads the native grant',
    /if \(name === 'notifications'\)[\s\S]{0,700}LocalNotifications\.checkPermissions/.test(lib));
check('both fall back to the browser API',
    (lib.match(/typeof Notification === 'undefined'/g) || []).length >= 2);

console.log('\nEvery permission has copy to show');
{
    for (const name of ['location', 'microphone', 'camera', 'notifications']) {
        const block = lib.match(new RegExp(`${name}: \\{[\\s\\S]*?\\},`));
        const text = block ? block[0] : '';
        check(`${name} has a reason and a recovery note`,
            /title:/.test(text) && /why:/.test(text) && /deniedHelp:/.test(text));
    }
    check('the sheet shows the recovery note on denial', /spec\.deniedHelp/.test(sheet));
    check('location offers the accuracy choice',
        /grant\(\{ precise: false \}\)/.test(sheet) && /grant\(\{ precise: true \}\)/.test(sheet));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
