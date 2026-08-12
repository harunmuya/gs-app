/**
 * Every verification, in one command.
 *
 * There are eighteen of these and no way to know that without listing the
 * directory, so in practice only the one being worked on ever got run. That is
 * how a check written to catch a regression stops catching it.
 *
 * It also fixes a trap. Some of these import application modules by their `@/`
 * alias, which Node cannot resolve on its own, so running them the obvious way
 * fails with ERR_MODULE_NOT_FOUND rather than a test result. The loader is
 * applied to every script here, so there is one correct way to run them and it
 * is the easy one.
 *
 * `npm run verify` runs them all.
 * `npm run verify -- swipe` runs the ones whose name contains "swipe".
 */
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const filter = process.argv[2] || '';

const scripts = readdirSync('scripts')
    .filter((f) => /^(verify|audit)-.*\.mjs$/.test(f))
    .filter((f) => !filter || f.includes(filter))
    .sort();

if (!scripts.length) {
    console.log(filter ? `No verification matches "${filter}".` : 'No verifications found.');
    process.exit(1);
}

const results = [];
for (const script of scripts) {
    const label = script.replace(/\.mjs$/, '');
    process.stdout.write(`${label.padEnd(34)}`);

    const run = spawnSync(
        process.execPath,
        ['--import', './scripts/alias-loader.mjs', join('scripts', script)],
        { encoding: 'utf8' },
    );

    const output = `${run.stdout || ''}${run.stderr || ''}`;
    // The audits report findings rather than passing or failing, so a count is
    // the honest summary for them; the verifications end with a tally.
    const tally = output.match(/(\d+) passed, (\d+) failed/);
    const findings = output.match(/(\d+) findings total/);

    /*
      A check that could not run is not a check that failed.

      Two of these need the dev server on :3000, and reporting them as failures
      when it is not running gives a suite that is permanently red. A suite that
      is always red is one people stop reading, which costs more than the two
      checks were worth.
    */
    const needsServer = /fetch failed|ECONNREFUSED/.test(output);
    const skipped = needsServer && run.status !== 0;
    const ok = run.status === 0;

    let summary;
    if (skipped) summary = 'needs the dev server on :3000';
    else if (tally) summary = `${tally[1]} passed, ${tally[2]} failed`;
    else if (findings) summary = `${findings[1]} findings`;
    else if (ok) summary = 'ok';
    else summary = (run.stderr || '').split('\n').find((l) => l.trim()) || `exit ${run.status}`;

    console.log(`${skipped ? 'skip ' : ok ? 'ok   ' : 'FAIL '} ${summary}`);
    results.push({ label, ok, skipped, output, summary });
}

const failed = results.filter((r) => !r.ok && !r.skipped);
const skippedRuns = results.filter((r) => r.skipped);
if (failed.length) {
    console.log(`\n${'='.repeat(60)}`);
    for (const result of failed) {
        console.log(`\n--- ${result.label}\n`);
        console.log(result.output.split('\n').slice(-40).join('\n'));
    }
}

const ran = results.length - skippedRuns.length;
console.log(`\n${ran - failed.length} of ${ran} verifications passed.`);
if (skippedRuns.length) {
    console.log(`${skippedRuns.length} skipped, needing the dev server: ${skippedRuns.map((r) => r.label).join(', ')}`);
    console.log('Start it with npm run dev to include them.');
}
process.exit(failed.length ? 1 : 0);
