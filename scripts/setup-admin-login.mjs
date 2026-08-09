/**
 * Configure admin login end to end, in one command.
 *
 *   node scripts/setup-admin-login.mjs
 *
 * Asks for a password at a hidden prompt, hashes it, writes all three variables
 * to Vercel production, and redeploys. You type the password once; it is never
 * written to a file, never echoed, never placed in shell history, and never
 * appears in the deployment — only the scrypt hash is uploaded, and a hash
 * cannot be turned back into the password.
 *
 * Requires: npx vercel already signed in (it is — as harunmuya).
 */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { randomBytes, scryptSync } from 'node:crypto';
import { stdin, stdout } from 'node:process';

const ADMIN_EMAIL = 'admin@genuinesugarmummies.co.ke';

// Matches PASSWORD_PREFIX in src/lib/security.js; verifyPassword rejects anything else.
const PASSWORD_PREFIX = 'scrypt';

/**
 * Passwords already published in this repository's git history.
 *
 * `Admin@2026!` was hardcoded in the source until it was removed on 2026-08-09.
 * Removing a secret from the working tree does not remove it from history, and
 * harunmuya/gs-app is public — so it remains readable by anyone with one
 * `git log -S`. Setting it as the live admin password would grant full access to
 * every member record, message and payment to any reader of the commit log.
 */
const PUBLISHED = new Set(['admin@2026!', 'admin@2026', 'tabby254$']);

function hashPassword(password) {
    const clean = String(password || '');
    if (clean.length < 8) throw new Error('Use at least 8 characters.');
    const salt = randomBytes(16).toString('hex');
    return `${PASSWORD_PREFIX}:${salt}:${scryptSync(clean, salt, 64).toString('hex')}`;
}

function askHidden(question) {
    return new Promise((resolve) => {
        const rl = createInterface({ input: stdin, output: stdout, terminal: true });
        const mask = () => { stdout.clearLine(0); stdout.cursorTo(0); stdout.write(question); };
        stdin.on('data', mask);
        rl.question(question, (value) => {
            stdin.removeListener('data', mask);
            rl.close();
            stdout.write('\n');
            resolve(value);
        });
    });
}

/** Run a command, optionally feeding it a value on stdin. */
function run(cmd, args, input) {
    return new Promise((resolve) => {
        const child = spawn(cmd, args, { shell: true, stdio: [input === undefined ? 'inherit' : 'pipe', 'pipe', 'pipe'] });
        let out = '';
        child.stdout.on('data', (d) => { out += d; });
        child.stderr.on('data', (d) => { out += d; });
        if (input !== undefined) { child.stdin.write(input); child.stdin.end(); }
        child.on('close', (code) => resolve({ code, out }));
    });
}

async function setEnv(name, value) {
    // Remove any existing value first; `env add` refuses to overwrite.
    await run('npx', ['vercel', 'env', 'rm', name, 'production', '--yes'], '');
    const { code, out } = await run('npx', ['vercel', 'env', 'add', name, 'production'], `${value}\n`);
    const ok = code === 0 || /Added Environment Variable/i.test(out);
    console.log(`  ${ok ? 'set  ' : 'FAILED'} ${name}`);
    if (!ok) console.log(`         ${out.trim().split('\n').slice(-2).join(' ')}`);
    return ok;
}

console.log(`Admin login setup for ${ADMIN_EMAIL}\n`);

const password = await askHidden('Choose an admin password (hidden): ');
const confirm = await askHidden('Type it again: ');

if (password !== confirm) {
    console.error('\nThey do not match. Nothing was changed.');
    process.exit(1);
}
if (PUBLISHED.has(String(password).toLowerCase())) {
    console.error('\nThat password appears in this repository\'s public git history.');
    console.error('Anyone can read it. Choose a different one — nothing was changed.');
    process.exit(1);
}

let hash;
try {
    hash = hashPassword(password);
} catch (err) {
    console.error(`\n${err.message}`);
    process.exit(1);
}

// Generated here rather than reused from SUPABASE_SERVICE_ROLE_KEY, which is the
// default fallback in lib/adminSession. Tying admin sessions to that key means
// rotating it silently signs out every admin.
const sessionSecret = randomBytes(32).toString('hex');

console.log('\nWriting to Vercel production…');
const results = [
    await setEnv('ADMIN_EMAIL', ADMIN_EMAIL),
    await setEnv('ADMIN_PASSWORD_HASH', hash),
    await setEnv('ADMIN_SESSION_SECRET', sessionSecret),
];

if (!results.every(Boolean)) {
    console.error('\nOne or more variables did not set. Fix the error above and re-run.');
    process.exit(1);
}

console.log('\nRedeploying so the new environment is picked up…');
const deploy = await run('npx', ['vercel', '--prod', '--yes']);
const alias = (deploy.out.match(/https:\/\/[^\s]*vercel\.app/g) || []).pop();

console.log(deploy.code === 0
    ? `\nDone. Sign in at ${alias || 'https://genuine-sugarmummies-app.vercel.app'}/admin`
    : `\nVariables are set, but the redeploy failed:\n${deploy.out.trim().split('\n').slice(-3).join('\n')}\n\nRun it yourself:  npx vercel --prod`);

console.log(`
Email:    ${ADMIN_EMAIL}
Password: the one you just typed — it was not stored anywhere but the hash.

If sign-in still fails, the deployment did not pick up the new variables.
Check with:  npx vercel env ls
`);
