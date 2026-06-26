const LEDGER_KEY = 'password_reset_otps_ledger';

export function isMissingOtpTable(error) {
    if (!error) return false;
    const text = `${error.code || ''} ${error.message || ''} ${error.details || ''}`.toLowerCase();
    return (
        text.includes('42p01') ||
        text.includes('pgrst205') ||
        text.includes('password_reset_otps') ||
        text.includes('schema cache') ||
        text.includes('does not exist')
    );
}

function parseLedgerValue(value) {
    if (!value) return { entries: {} };
    if (typeof value === 'string') {
        try {
            return JSON.parse(value) || { entries: {} };
        } catch {
            return { entries: {} };
        }
    }
    return value;
}

async function readLedger(supabaseAdmin) {
    const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('*')
        .eq('key', LEDGER_KEY)
        .maybeSingle();

    if (error) throw error;

    return {
        ledgerId: data?.id || null,
        ledger: parseLedgerValue(data?.value),
    };
}

function pruneLedger(ledger) {
    const entries = ledger.entries || {};
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    Object.entries(entries).forEach(([email, entry]) => {
        const expiredLongAgo = entry.expires_at && new Date(entry.expires_at).getTime() < oneDayAgo;
        const usedLongAgo = entry.used_at && new Date(entry.used_at).getTime() < oneDayAgo;
        if (expiredLongAgo || usedLongAgo) delete entries[email];
    });

    ledger.entries = entries;
    return ledger;
}

async function writeLedger(supabaseAdmin, ledgerId, ledger) {
    const payload = { value: pruneLedger(ledger), updated_at: new Date().toISOString() };

    if (ledgerId) {
        const { error } = await supabaseAdmin
            .from('app_settings')
            .update(payload)
            .eq('id', ledgerId);
        if (error) throw error;
        return;
    }

    const { error } = await supabaseAdmin
        .from('app_settings')
        .insert({ key: LEDGER_KEY, ...payload });
    if (error) throw error;
}

export async function saveResetOtp(supabaseAdmin, record) {
    const usedAt = new Date().toISOString();

    const markUsed = await supabaseAdmin
        .from('password_reset_otps')
        .update({ used_at: usedAt })
        .eq('email', record.email)
        .is('used_at', null);

    if (markUsed.error && !isMissingOtpTable(markUsed.error)) {
        console.warn('[Password Reset OTP] Could not mark previous codes used:', markUsed.error.message);
    }

    const { error: insertError } = await supabaseAdmin
        .from('password_reset_otps')
        .insert(record);

    if (!insertError) {
        return { store: 'password_reset_otps' };
    }

    if (!isMissingOtpTable(insertError)) {
        throw insertError;
    }

    const { ledgerId, ledger } = await readLedger(supabaseAdmin);
    const entries = ledger.entries || {};
    entries[record.email] = {
        ...record,
        id: record.email,
        attempts: 0,
        used_at: null,
        created_at: new Date().toISOString(),
    };
    ledger.entries = entries;
    await writeLedger(supabaseAdmin, ledgerId, ledger);

    return { store: 'app_settings' };
}

export async function findActiveResetOtp(supabaseAdmin, email) {
    const tableResult = await supabaseAdmin
        .from('password_reset_otps')
        .select('*')
        .eq('email', email)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (tableResult.data) {
        return { otp: tableResult.data, store: 'password_reset_otps' };
    }

    if (tableResult.error && !isMissingOtpTable(tableResult.error)) {
        throw tableResult.error;
    }

    const { ledgerId, ledger } = await readLedger(supabaseAdmin);
    const entry = ledger.entries?.[email] || null;

    if (!entry || entry.used_at || new Date(entry.expires_at).getTime() <= Date.now()) {
        return { otp: null, store: 'app_settings', ledgerId, ledger };
    }

    return { otp: entry, store: 'app_settings', ledgerId, ledger };
}

export async function updateResetOtp(supabaseAdmin, storeState, changes) {
    const { store, otp, ledgerId, ledger } = storeState;

    if (store === 'password_reset_otps') {
        const { error } = await supabaseAdmin
            .from('password_reset_otps')
            .update(changes)
            .eq('id', otp.id);
        if (error) throw error;
        return;
    }

    const nextLedger = ledger || { entries: {} };
    nextLedger.entries = nextLedger.entries || {};
    nextLedger.entries[otp.email] = { ...otp, ...changes };
    await writeLedger(supabaseAdmin, ledgerId, nextLedger);
}
