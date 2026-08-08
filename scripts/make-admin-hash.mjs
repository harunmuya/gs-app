/**
 * Produce ADMIN_PASSWORD_HASH for the admin control panel.
 *
 * Run this on your own machine. It reads the password from a hidden prompt, so
 * the plaintext is never typed into a chat window, never written to a file,
 * never stored in shell history, and never leaves this process. Only the scrypt
 * hash is printed, and a hash cannot be reversed into the password.
 *
 *   node scripts/make-admin-hash.mjs
 *
 * The output goes into Vercel as ADMIN_PASSWORD_HASH. lib/adminSession prefers
 * the hash over the plaintext ADMIN_PASSWORD precisely so the real password
 * never sits in an environment variable that anyone with project access can read.
 */
import { createInterface } from 'node:readline';
import { randomBytes, scryptSync } from 'node:crypto';
import { stdin, stdout } from 'node:process';

// Must match PASSWORD_PREFIX in src/lib/security.js — verifyPassword rejects
// anything with a different prefix.
const PASSWORD_PREFIX = 'scrypt';

function hashPassword(password) {
    const clean = String(password || '');
    if (clean.length < 6) throw new Error('Password must be at least 6 characters.');
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(clean, salt, 64).toString('hex');
    return `${PASSWORD_PREFIX}:${salt}:${hash}`;
}

/** Read a line without echoing it to the terminal. */
function askHidden(question) {
    return new Promise((resolve) => {
        const rl = createInterface({ input: stdin, output: stdout, terminal: true });
        const onData = (char) => {
            // Re-write the prompt with no characters, so nothing is left on screen
            // and nothing is captured by a screen recorder or a shoulder.
            const s = String(char);
            if (s === '\n' || s === '\r' || s === '') {
                stdin.removeListener('data', onData);
                return;
            }
            stdout.clearLine(0);
            stdout.cursorTo(0);
            stdout.write(question);
        };
        stdin.on('data', onData);
        rl.question(question, (value) => {
            rl.close();
            stdout.write('\n');
            resolve(value);
        });
    });
}

const password = await askHidden('New admin password (input hidden): ');
const confirm = await askHidden('Confirm it: ');

if (password !== confirm) {
    console.error('\nThey do not match. Nothing was generated.');
    process.exit(1);
}

let hash;
try {
    hash = hashPassword(password);
} catch (err) {
    console.error(`\n${err.message}`);
    process.exit(1);
}

// Weak passwords are worth a word, but not worth blocking — this account is
// reachable only by someone who already knows the admin email.
if (password.length < 12) {
    console.log('\nNote: under 12 characters. This is the key to every member record.');
}

console.log('\nADMIN_PASSWORD_HASH');
console.log(hash);

console.log(`
Add it to Vercel — three variables, production scope:

  npx vercel env add ADMIN_EMAIL production
      admin@genuinesugarmummies.co.ke

  npx vercel env add ADMIN_PASSWORD_HASH production
      (paste the hash above)

  npx vercel env add ADMIN_SESSION_SECRET production
      (any random string, 32+ characters)

Then redeploy so the new environment is picked up:

  npx vercel --prod

Why ADMIN_SESSION_SECRET matters here: without it, lib/adminSession derives the
session signing key from SUPABASE_SERVICE_ROLE_KEY. That works, but it ties your
admin sessions to a key you are about to rotate — rotating it would silently
invalidate every signed-in admin. Setting an explicit secret decouples the two.

The hash above is safe to paste into Vercel. It is not safe to assume the
password is private if you have typed it anywhere else.
`);
