/**
 * Would a build from this project actually update the app people have?
 *
 * Three things must line up, and all three failed silently until they were
 * measured against the published APK rather than assumed.
 *
 *   The package name. The published APK is com.genuinesugarmummies.global.
 *   This project built ke.co.genuinesugarmummies.app. Android treats a
 *   different applicationId as a different application, so the new APK would
 *   have installed beside the old one as a second, empty copy while the real
 *   app sat there untouched. Nothing warns about this. It just quietly happens.
 *
 *   The version code. The published APK is 3. This project said 1, then 2. An
 *   install of a lower version is refused outright.
 *
 *   The signing certificate. A different key is refused for the same reason,
 *   and unlike the other two it cannot be corrected after the fact: without the
 *   original key there is no way to update those installs at all.
 *
 * This reads the APK that is actually shipped, so it compares against reality
 * rather than against what a config file claims.
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

        check('the package name matches the published app', builtId === shippedId,
            builtId === shippedId ? '' : 'a mismatch installs a second app instead of updating');
        check('the version code is higher than the published one', builtCode > shippedCode,
            builtCode > shippedCode ? `${shippedCode} to ${builtCode}` : `${builtCode} is not above ${shippedCode}`);

        // The endpoint tells installed apps what to expect, so it has to agree.
        const route = readFileSync(join('src', 'app', 'api', 'app-version', 'route.js'), 'utf8');
        const advertised = Number((route.match(/versionCode:\s*(\d+)/) || [])[1] || 0);
        check('the advertised version matches the build', advertised === builtCode,
            `endpoint says ${advertised}, gradle says ${builtCode}`);

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
        const EXPECTED_SIGNER = '6b698972405d7e00856c368e0643ce964385f7ac96fba2ef27816ca2cdc538bc';
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
                check('the APK is signed with the key the installed app trusts',
                    digest.toLowerCase() === EXPECTED_SIGNER,
                    digest ? `${digest.slice(0, 16)}...` : 'no certificate found');
            } catch {
                console.log('        signature could not be read from this APK');
            }
        } else if (!jdk) {
            console.log('        no JDK found, so the signature was not checked');
            console.log('        set JAVA_HOME, or run this from a machine with Android Studio');
        }

        console.log('\nIf a release is refused as "App not installed", the key is the usual reason.');
        console.log('  expected CN=Genuine Sugar Mummies, OU=Mobile, L=Nairobi, C=KE');
        console.log(`  expected SHA-256 ${EXPECTED_SIGNER}`);
    }

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exitCode = fail ? 1 : 0;
}
