import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Parse .env.local manually
const envContent = readFileSync('.env.local', 'utf8');
envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex < 0) return;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function runSQL(label, sql) {
    console.log(`\n=== Running: ${label} ===`);
    const { data, error } = await supabase.rpc('exec_sql', { sql_text: sql }).maybeSingle();
    if (error) {
        // rpc might not exist, try direct approach
        console.log(`  RPC not available, trying direct approach...`);
        return false;
    }
    console.log('  Result:', data);
    return true;
}

async function fixWithDirectQueries() {
    console.log('\n=== Fixing categories with direct Supabase queries ===\n');

    // Step 1: Check current state
    console.log('--- Current state ---');
    const { data: allUsers, error: checkErr } = await supabase
        .from('users')
        .select('id, display_name, email, profile_label, member_category, looking_for, is_seed_profile')
        .order('created_at', { ascending: false })
        .limit(5000);

    if (checkErr) {
        console.error('Error fetching users:', checkErr.message);
        process.exit(1);
    }

    const stats = { total: allUsers.length, seed: 0, real: 0, wrongLabel: 0, fixed: 0 };
    const wrongOnes = [];

    allUsers.forEach(u => {
        if (u.is_seed_profile) stats.seed++;
        else stats.real++;

        const label = (u.profile_label || '').toLowerCase();
        const lookingFor = (u.looking_for || '').toLowerCase();
        
        // Check for wrong looking_for
        let expectedLookingFor = '';
        if (label === 'sugar_mummy') expectedLookingFor = 'sugar guy / toyboy';
        else if (label === 'sugar_daddy') expectedLookingFor = 'mistress';
        else if (label === 'mistress') expectedLookingFor = 'sugar daddy';
        else if (label === 'toyboy') expectedLookingFor = 'sugar mummy';

        if (expectedLookingFor && lookingFor !== expectedLookingFor) {
            stats.wrongLabel++;
            wrongOnes.push({
                id: u.id,
                name: u.display_name,
                label: u.profile_label,
                lookingFor: u.looking_for,
                expected: expectedLookingFor,
                isSeed: u.is_seed_profile,
            });
        }
    });

    console.log(`Total users: ${stats.total} (${stats.seed} seed, ${stats.real} real)`);
    console.log(`Wrong looking_for: ${stats.wrongLabel}`);
    if (wrongOnes.length > 0) {
        console.log('\nSample wrong profiles:');
        wrongOnes.slice(0, 10).forEach(w => {
            console.log(`  [${w.isSeed ? 'SEED' : 'REAL'}] "${w.name}" label=${w.label} looking_for="${w.lookingFor}" should be="${w.expected}"`);
        });
    }

    // Step 2: Fix Sugar Mummies - should look for "Sugar Guy / Toyboy"
    console.log('\n--- Fixing Sugar Mummies ---');
    const { data: d1, error: e1 } = await supabase
        .from('users')
        .update({
            looking_for: 'Sugar Guy / Toyboy',
            intent_summary: 'I am a Sugar Mummy looking for Sugar Guy / Toyboy.',
            member_category: 'sugar_mummy',
        })
        .eq('profile_label', 'sugar_mummy')
        .neq('looking_for', 'Sugar Guy / Toyboy')
        .select('id');
    console.log(`  Fixed: ${d1?.length || 0} profiles`, e1 ? `Error: ${e1.message}` : '');

    // Step 3: Fix Sugar Daddies - should look for "Mistress"
    console.log('--- Fixing Sugar Daddies ---');
    const { data: d2, error: e2 } = await supabase
        .from('users')
        .update({
            looking_for: 'Mistress',
            intent_summary: 'I am a Sugar Daddy looking for Mistress.',
            member_category: 'sugar_daddy',
        })
        .eq('profile_label', 'sugar_daddy')
        .neq('looking_for', 'Mistress')
        .select('id');
    console.log(`  Fixed: ${d2?.length || 0} profiles`, e2 ? `Error: ${e2.message}` : '');

    // Step 4: Fix Mistresses - should look for "Sugar Daddy"
    console.log('--- Fixing Mistresses ---');
    const { data: d3, error: e3 } = await supabase
        .from('users')
        .update({
            looking_for: 'Sugar Daddy',
            intent_summary: 'I am a Mistress looking for Sugar Daddy.',
            member_category: 'mistress',
        })
        .eq('profile_label', 'mistress')
        .neq('looking_for', 'Sugar Daddy')
        .select('id');
    console.log(`  Fixed: ${d3?.length || 0} profiles`, e3 ? `Error: ${e3.message}` : '');

    // Step 5: Fix Toyboys - should look for "Sugar Mummy"
    console.log('--- Fixing Toyboys ---');
    const { data: d4, error: e4 } = await supabase
        .from('users')
        .update({
            looking_for: 'Sugar Mummy',
            intent_summary: 'I am a Sugar Guy / Toyboy looking for Sugar Mummy.',
            member_category: 'toyboy',
        })
        .eq('profile_label', 'toyboy')
        .neq('looking_for', 'Sugar Mummy')
        .select('id');
    console.log(`  Fixed: ${d4?.length || 0} profiles`, e4 ? `Error: ${e4.message}` : '');

    // Step 6: Fix profiles with MISSING profile_label but with member_category
    console.log('--- Fixing missing profile_labels from member_category ---');
    for (const cat of ['sugar_mummy', 'sugar_daddy', 'mistress', 'toyboy']) {
        const { data: d5, error: e5 } = await supabase
            .from('users')
            .update({ profile_label: cat })
            .eq('member_category', cat)
            .or('profile_label.is.null,profile_label.eq.')
            .select('id');
        if (d5?.length) console.log(`  Set profile_label=${cat} on ${d5.length} profiles`);
    }

    // Step 7: Fix profiles with WRONG profile_label (label doesn't match their looking_for)
    // e.g., someone labeled "toyboy" but looking for "Sugar Mummy" — that's CORRECT
    // e.g., someone labeled "toyboy" but looking for "Mistress" — label should be "sugar_daddy"
    console.log('--- Fixing profiles where label contradicts looking_for ---');
    
    // If looking_for is "Sugar Guy / Toyboy", label should be sugar_mummy
    const { data: d6a } = await supabase
        .from('users')
        .update({ profile_label: 'sugar_mummy', member_category: 'sugar_mummy' })
        .eq('looking_for', 'Sugar Guy / Toyboy')
        .neq('profile_label', 'sugar_mummy')
        .select('id, display_name, profile_label');
    if (d6a?.length) {
        console.log(`  Re-labeled ${d6a.length} profiles to sugar_mummy (they look for Sugar Guy / Toyboy)`);
        d6a.slice(0, 5).forEach(p => console.log(`    "${p.display_name}" was ${p.profile_label}`));
    }

    // If looking_for is "Mistress", label should be sugar_daddy
    const { data: d6b } = await supabase
        .from('users')
        .update({ profile_label: 'sugar_daddy', member_category: 'sugar_daddy' })
        .eq('looking_for', 'Mistress')
        .neq('profile_label', 'sugar_daddy')
        .select('id, display_name, profile_label');
    if (d6b?.length) {
        console.log(`  Re-labeled ${d6b.length} profiles to sugar_daddy (they look for Mistress)`);
        d6b.slice(0, 5).forEach(p => console.log(`    "${p.display_name}" was ${p.profile_label}`));
    }

    // If looking_for is "Sugar Daddy", label should be mistress
    const { data: d6c } = await supabase
        .from('users')
        .update({ profile_label: 'mistress', member_category: 'mistress' })
        .eq('looking_for', 'Sugar Daddy')
        .neq('profile_label', 'mistress')
        .select('id, display_name, profile_label');
    if (d6c?.length) {
        console.log(`  Re-labeled ${d6c.length} profiles to mistress (they look for Sugar Daddy)`);
        d6c.slice(0, 5).forEach(p => console.log(`    "${p.display_name}" was ${p.profile_label}`));
    }

    // If looking_for is "Sugar Mummy", label should be toyboy
    const { data: d6d } = await supabase
        .from('users')
        .update({ profile_label: 'toyboy', member_category: 'toyboy' })
        .eq('looking_for', 'Sugar Mummy')
        .neq('profile_label', 'toyboy')
        .select('id, display_name, profile_label');
    if (d6d?.length) {
        console.log(`  Re-labeled ${d6d.length} profiles to toyboy (they look for Sugar Mummy)`);
        d6d.slice(0, 5).forEach(p => console.log(`    "${p.display_name}" was ${p.profile_label}`));
    }

    // Step 8: Sync member_category to profile_label for all
    console.log('--- Syncing member_category to profile_label ---');
    for (const cat of ['sugar_mummy', 'sugar_daddy', 'mistress', 'toyboy']) {
        const { data: d7 } = await supabase
            .from('users')
            .update({ member_category: cat })
            .eq('profile_label', cat)
            .neq('member_category', cat)
            .select('id');
        if (d7?.length) console.log(`  Synced ${d7.length} ${cat} profiles`);
    }

    // Step 9: Make all non-banned real users visible
    console.log('--- Making real users visible ---');
    const { data: d8 } = await supabase
        .from('users')
        .update({ show_in_public: true })
        .eq('is_seed_profile', false)
        .eq('is_banned', false)
        .eq('is_suspended', false)
        .eq('admin_approved', true)
        .eq('show_in_public', false)
        .select('id');
    console.log(`  Made ${d8?.length || 0} real users visible`);

    // Step 10: Delete duplicate seed profiles (keep newest per email)
    console.log('--- Removing duplicate seeds ---');
    const { data: seeds } = await supabase
        .from('users')
        .select('id, email, created_at')
        .eq('is_seed_profile', true)
        .order('created_at', { ascending: false });

    if (seeds?.length) {
        const emailSeen = new Map();
        const toDelete = [];
        seeds.forEach(s => {
            const key = (s.email || '').toLowerCase();
            if (emailSeen.has(key)) {
                toDelete.push(s.id);
            } else {
                emailSeen.set(key, s.id);
            }
        });
        if (toDelete.length) {
            // Delete in batches of 50
            for (let i = 0; i < toDelete.length; i += 50) {
                const batch = toDelete.slice(i, i + 50);
                await supabase.from('users').delete().in('id', batch);
            }
            console.log(`  Deleted ${toDelete.length} duplicate seed profiles`);
        } else {
            console.log('  No duplicate seeds found');
        }
    }

    // Step 11: Final verification
    console.log('\n=== Final Verification ===');
    const { data: final } = await supabase
        .from('users')
        .select('profile_label, looking_for, is_seed_profile')
        .limit(5000);

    const verify = { total: 0, correct: 0, wrong: 0, wrongList: [] };
    (final || []).forEach(u => {
        verify.total++;
        const label = (u.profile_label || '').toLowerCase();
        const lf = (u.looking_for || '').toLowerCase();
        let expected = '';
        if (label === 'sugar_mummy') expected = 'sugar guy / toyboy';
        else if (label === 'sugar_daddy') expected = 'mistress';
        else if (label === 'mistress') expected = 'sugar daddy';
        else if (label === 'toyboy') expected = 'sugar mummy';

        if (expected && lf === expected) verify.correct++;
        else if (expected) {
            verify.wrong++;
            if (verify.wrongList.length < 5) verify.wrongList.push({ label, lf, expected, seed: u.is_seed_profile });
        }
    });

    console.log(`Total: ${verify.total} | Correct: ${verify.correct} | Still wrong: ${verify.wrong}`);
    if (verify.wrongList.length) {
        console.log('Still wrong samples:');
        verify.wrongList.forEach(w => console.log(`  [${w.seed ? 'SEED' : 'REAL'}] label=${w.label} looking_for="${w.lf}" should="${w.expected}"`));
    }

    console.log('\n✅ Database fix complete!');
}

fixWithDirectQueries().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
