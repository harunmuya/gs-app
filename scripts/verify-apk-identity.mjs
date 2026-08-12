/**
 * Is the APK in the downloads folder even this application?
 *
 * It is not, and finding that out the hard way is why this exists.
 *
 * public/downloads holds com.genuinesugarmummies.global, labelled GS Global,
 * loading https://genuinesugarmummies-com-v2.vercel.app. That is the V2 app,
 * built from the separate genuinesugarmummies.com project. This project is V1:
 * ke.co.genuinesugarmummies.app, loading its own deployment.
 *
 * So the download link on the V1 site hands out the V2 app. Anyone installing
 * from it gets the other product, and none of the work on this site reaches
 * them.
 *
 * The first version of this script assumed the APK it found was this project's
 * published build, and concluded that the project's applicationId was wrong.
 * Acting on that changed V1 to identify as V2, which would have shipped V1 over
 * V2 on every phone that had it. A checker that reads one artefact and infers
 * intent from it can be confidently wrong; it now reports the mismatch and
 * names both possibilities rather than picking one.
 *
 * When a real V1 APK exists, three things must line up for it to update an
 * install: the package name, a higher versionCode, and the same signing
 * certificate. The last cannot be corrected afterwards, because without the
 * original key those installs can never be updated by anybody again.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

let pass = 0;
let fail = 0;
const check = (label, ok, detail = '') => {
    if (ok) { pass++; console.log(`  ok    ${label}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`  FAIL  ${label}${detail ? `  ${detail}` : ''}`); }
};

const APK = join('public', 'downloads', 'genuine-sugar-mummies.apk');
const GRADLE = join('android', 'app', 'build.gradle');

if (!existsSync(APK) || !existsSync(GRADLE)) {
    console.log('\nNo shipped APK or no Android project here, nothing to compare.');
    process.exitCode = 0;
} else {
    /*
      Comments are stripped before anything is read out of the file. The first
      pass matched versionCode inside a comment that mentions the published
      version 3, so it reported the build as 3 when gradle says 4. A checker
      that reads prose as configuration is worse than none.
    */
    const gradle = readFileSync(GRADLE, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
    const builtId = (gradle.match(/applicationId\s+"([^"]+)"/) || [])[1] || '';
    const builtCode = Number((gradle.match(/versionCode\s+(\d+)/) || [])[1] || 0);

    /*
      aapt ships with the Android build tools. Without it the identity cannot be
      read, and reporting that plainly is better than passing on no evidence.
    */
    const sdk = process.env.ANDROID_HOME
        || process.env.ANDROID_SDK_ROOT
        || join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
    let aapt = null;
    try {
        const versions = readdirSync(join(sdk, 'build-tools')).sort().reverse();
        for (const version of versions) {
            const candidate = join(sdk, 'build-tools', version, process.platform === 'win32' ? 'aapt.exe' : 'aapt');
            if (existsSync(candidate)) { aapt = candidate; break; }
        }
    } catch { /* no sdk on this machine */ }

    if (!aapt) {
        console.log('\nAndroid build tools not found, so the shipped APK cannot be read here.');
        console.log(`This project builds ${builtId} versionCode ${builtCode}.`);
        console.log('Run this on a machine with the SDK before publishing a release.');
        process.exitCode = 0;
    } else {
        const badging = execFileSync(aapt, ['dump', 'badging', APK], { encoding: 'utf8' });
        const shippedId = (badging.match(/package: name='([^']+)'/) || [])[1] || '';
        const shippedCode = Number((badging.match(/versionCode='(\d+)'/) || [])[1] || 0);

        console.log(`\nShipped APK : ${shippedId} versionCode ${shippedCode}`);
        console.log(`This build   : ${builtId} versionCode ${builtCode}\n`);

        /*
          A mismatch here does not mean the build is wrong. It can equally mean
          the APK in the downloads folder belongs to somebody else, which is
          exactly what happened: com.genuinesugarmummies.global is the V2 app
          from the genuinesugarmummies.com project, loading the V2 deployment,
          sitting in V1's download folder. Reading it as this project's
          published build led to changing this project's identity to match, and
          that would have shipped V1 over V2 on every phone that had it.

          So the message says both possibilities rather than assuming one.
        */
        check('the APK in downloads is this app', builtId === shippedId,
            builtId === shippedId
                ? ''
                : `downloads holds ${shippedId}, this project builds ${builtId}`);
        /*
          Equal versions are the correct steady state, not a failure.

          This asked for the build to be strictly higher than the APK in
          downloads, which is the right question only while a release is being
          prepared. Once that release is published the two are the same
          artefact, and demanding "higher" fails the moment everything is
          actually in order.

          What is genuinely wrong is a build behind what is published: it means
          the version was lowered, and an APK built from it could never install
          over what people already have.
        */
        if (builtId === shippedId) {
            check('the build is not behind what is published', builtCode >= shippedCode,
                builtCode === shippedCode
                    ? `both at ${builtCode}, in sync`
                    : `build is ${builtCode}, published is ${shippedCode}`);
            if (builtCode > shippedCode) {
                console.log(`        a release is pending: build ${builtCode} has not been copied into downloads yet`);
            }
        } else {
            console.log('        version and signature not compared, the APK is a different application');
        }

        // The endpoint tells installed apps what to expect, so it has to agree.
        const route = readFileSync(join('src', 'app', 'api', 'app-version', 'route.js'), 'utf8');
        if (/const CURRENT = null;/.test(route)) {
            console.log('        no update is advertised, which is correct while no V1 APK exists');
        } else {
            const advertised = Number((route.match(/versionCode:\s*(\d+)/) || [])[1] || 0);
            check('the advertised version matches the build', advertised === builtCode,
                `endpoint says ${advertised}, gradle says ${builtCode}`);
        }

        /*
          The signature, checked on the APK rather than on the keystore.

          Reading the keystore would need its password, which is not in the repo
          and should not be. The APK carries its signing certificate in the
          clear, so the same question is answerable from the artefact with no
          secret involved: sign the release, drop it in, and this says whether
          the key was right.

          It matters more than the other two checks. A wrong package name or a
          low version code can be corrected and rebuilt. A release signed with
          the wrong key cannot update the installs that trusted the old one, and
          if the original key is lost those installs can never be updated again
          by anybody.
        */
        /*
          V1's signing key, from its first release on 2026-08-12.

          The fingerprint here was briefly the V2 one, read off the wrong APK,
          which would have failed a correct V1 build and passed a wrong one. It
          is V1's own now.

          Every future V1 release must match this. Once members have installed,
          an APK signed with any other key cannot update them: Android refuses,
          and uninstalling to fix it loses their local state. The keystore is
          gitignored, so it lives on one machine and nowhere else unless
          somebody backs it up.
        */
        const EXPECTED_SIGNER = process.env.GS_EXPECTED_SIGNER
            || 'ccfdd9a8f5d856d1f0b4bcc8890635237b801bedd47018fd9c555dd245addbd9';
        const apksigner = aapt.replace(/aapt(\.exe)?$/, (m) => (m.endsWith('.exe') ? 'apksigner.bat' : 'apksigner'));

        /*
          apksigner is a shell wrapper around a Java tool, so it needs a JDK it
          can find. JAVA_HOME is rarely set on a machine where the only Java is
          the one bundled with Android Studio, and without it the wrapper exits
          before doing anything, which reads as "no signature" rather than as
          "no Java".
        */
        const jdk = process.env.JAVA_HOME || [
            'C:/Program Files/Android/Android Studio/jbr',
            'C:/Program Files/Android/Android Studio/jre',
            join(process.env.LOCALAPPDATA || '', 'Programs', 'Android Studio', 'jbr'),
        ].find((candidate) => existsSync(join(candidate, 'bin')));

        if (existsSync(apksigner) && jdk) {
            try {
                // apksigner on Windows is a .bat, which cannot be executed
                // directly and has to go through a shell.
                const out = execFileSync(apksigner, ['verify', '--print-certs', `"${APK}"`], {
                    encoding: 'utf8',
                    env: { ...process.env, JAVA_HOME: jdk },
                    shell: process.platform === 'win32',
                });
                const digest = (out.match(/SHA-256 digest:\s*([0-9a-f]+)/i) || [])[1] || '';
                if (EXPECTED_SIGNER) {
                    check('the APK is signed with the key the installed app trusts',
                        digest.toLowerCase() === EXPECTED_SIGNER,
                        digest ? `${digest.slice(0, 16)}...` : 'no certificate found');
                } else {
                    console.log(`        signed by ${digest.slice(0, 16)}... (no expected key recorded yet)`);
                }
            } catch {
                console.log('        signature could not be read from this APK');
            }
        } else if (!jdk) {
            console.log('        no JDK found, so the signature was not checked');
            console.log('        set JAVA_HOME, or run this from a machine with Android Studio');
        }

        if (builtId !== shippedId) {
            console.log('\nThe V1 site is handing out the V2 app. Either put a V1 build at that');
            console.log('path, or point the download at wherever the V2 APK is meant to live.');
        } else if (EXPECTED_SIGNER) {
            console.log('\nIf a release is refused as "App not installed", the key is the usual reason.');
            console.log(`  expected SHA-256 ${EXPECTED_SIGNER}`);
        }
    }

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exitCode = fail ? 1 : 0;
}
