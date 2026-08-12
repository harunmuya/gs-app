/**
 * Are the Resend DNS records live yet?
 *
 * Email delivery has been dead since 9 August 2026 because Resend will not send
 * from an unverified domain, and genuinesugarmummies.co.ke is served by its own
 * nameservers (ns1 and ns2, both 102.68.86.59), so the records have to be added
 * to the BIND zone on the VPS. Nothing in this repo can do that.
 *
 * What this can do is tell you the moment it has worked, without guessing. DNS
 * changes propagate on the zone's TTL, so the honest answer to "is it done yet"
 * is a lookup, not a refresh of the Resend dashboard.
 *
 * Run it after editing the zone. When all three pass, press Verify in Resend.
 */
import { Resolver } from 'node:dns/promises';

const DOMAIN = 'genuinesugarmummies.co.ke';

/*
  Ask the domain's own nameserver directly.

  A public resolver will happily serve a cached negative answer for as long as
  the SOA negative TTL says, so checking through one means waiting out a cache
  to see a change that is already live. Asking the authoritative server is the
  difference between "not done" and "not propagated".
*/
const authoritative = new Resolver();
authoritative.setServers(['102.68.86.59']);

const EXPECTED = {
    dkim: 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC+kemJJsYaIayT9sunA/EILrFyGb0wIt9MjxX+J4TL3GGxxodDXzL8TB0O805vGadDzV5UIqu3+duXEsslQo2PiRpBaiC3oue0Kv+9SpBAXfwlHtGUzbBZLSl+XzMBEhhAIEDlHdL8vYQtFk5AanW1tnwpWCSU7GNejDy7meODqQIDAQAB',
    mx: 'feedback-smtp.us-east-1.amazonses.com',
    spf: 'v=spf1 include:amazonses.com ~all',
};

let pass = 0;
let fail = 0;
const check = (label, ok, detail = '') => {
    if (ok) { pass++; console.log(`  ok    ${label}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`  FAIL  ${label}${detail ? `  ${detail}` : ''}`); }
};

async function txt(name) {
    try { return (await authoritative.resolveTxt(name)).map((parts) => parts.join('')); }
    catch { return []; }
}

console.log(`\nAsking ${DOMAIN} nameservers directly (102.68.86.59)\n`);

{
    const records = await txt(`resend._domainkey.${DOMAIN}`);
    const found = records.find((r) => r.includes(EXPECTED.dkim.slice(0, 40)));
    check('DKIM  resend._domainkey  TXT', Boolean(found),
        found ? `${found.length} chars` : records.length ? 'present but does not match the key Resend issued' : 'missing');
    // A split key still resolves, but a truncated one silently fails signing.
    if (found && !found.includes(EXPECTED.dkim)) {
        console.log('        the record exists but is not the full key. It is 218 characters and must not be truncated.');
    }
}

{
    let records = [];
    try { records = await authoritative.resolveMx(`send.${DOMAIN}`); } catch { /* missing */ }
    const found = records.find((r) => r.exchange === EXPECTED.mx);
    check('MX    send  MX', Boolean(found),
        found ? `priority ${found.priority}` : records.length ? records.map((r) => r.exchange).join(', ') : 'missing');
}

{
    const records = await txt(`send.${DOMAIN}`);
    const found = records.find((r) => r.includes('amazonses.com'));
    check('SPF   send  TXT', Boolean(found), found || (records.length ? records.join(' | ') : 'missing'));
}

console.log('\nThe root domain, which must not be disturbed');
{
    const root = await txt(DOMAIN);
    const spf = root.filter((r) => r.startsWith('v=spf1'));
    // More than one SPF record at a name is invalid and breaks all of it, which
    // is the classic way this edit goes wrong.
    check('exactly one SPF at the root', spf.length === 1,
        spf.length === 0 ? 'none found' : spf.length > 1 ? `${spf.length} found, this breaks SPF entirely` : '');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
    console.log('\nAdd these to the BIND zone for the domain, then reload it:');
    console.log('');
    console.log('  resend._domainkey  IN  TXT  "p=<the 218 character key>"');
    console.log('  send               IN  MX   10 feedback-smtp.us-east-1.amazonses.com.');
    console.log('  send               IN  TXT  "v=spf1 include:amazonses.com ~all"');
    console.log('');
    console.log('The trailing dot on the MX target is required. Increment the zone serial.');
} else {
    console.log('\nAll three are live. Press Verify in the Resend dashboard, then run');
    console.log('npm run verify -- email-delivery to confirm mail is flowing again.');
}
process.exit(fail ? 1 : 0);
