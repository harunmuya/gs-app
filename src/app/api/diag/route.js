import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseAdmin';

export async function GET() {
    const supabase = createServerSupabaseClient({ admin: true });
    if (!supabase) {
        return NextResponse.json({ error: 'No supabase client' }, { status: 503 });
    }

    const diagnostics = {};
    const testEmail = `diag_full_${Date.now()}@test.local`;

    // Test with FULL accountPayload-like insert (same fields the app sends)
    const fullPayload = {
        email: testEmail,
        display_name: 'Test User',
        avatar_url: '',
        photos: [],
        bio: 'Test bio for diagnostics',
        description: 'Test bio for diagnostics',
        age: 25,
        location: 'Nairobi',
        country: 'Kenya',
        city: 'Nairobi',
        phone: '0700000000',
        phone_number: '0700000000',
        profile_label: 'member',
        member_category: 'member',
        subscription_tier: 'free',
        verified: false,
        verification_status: 'unsubmitted',
        show_in_public: true,
        is_banned: false,
        is_suspended: false,
        last_seen_at: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        password_hash: 'test_hash_value',
        password_updated_at: new Date().toISOString(),
        // fullSchema extra fields:
        username: 'test_diag_user',
        looking_for: 'Test',
        intent_summary: 'Test intent',
        wants: '',
        needed_qualities: '',
        age_range_preference: '',
        hobbies: [],
        interests: [],
        admin_approved: true,
        phone_reveal_plan: 'silver',
        package_locked: false,
        verification_selfie_url: '',
        verification_document_url: '',
        verification_document_type: '',
        verification_phone: '0700000000',
        verification_submitted_at: null,
        verification_rejection_reason: '',
        is_seed_profile: false,
        body_type: '',
    };

    // Step 1: Try INSERT with full payload
    try {
        const { data, error } = await supabase
            .from('users')
            .insert(fullPayload)
            .select('id, email')
            .maybeSingle();

        if (error) {
            diagnostics.full_insert = {
                error: `${error.code}: ${error.message}`,
                details: error.details || '',
                hint: error.hint || '',
            };

            // Try to find which column is the problem by removing fields one by one
            const suspectFields = ['body_type', 'intent_summary', 'hobbies', 'interests', 'phone_reveal_plan', 'is_seed_profile', 'looking_for', 'wants', 'needed_qualities', 'age_range_preference', 'verification_selfie_url', 'verification_document_url', 'verification_document_type', 'verification_phone', 'verification_submitted_at', 'verification_rejection_reason', 'password_updated_at', 'last_seen'];

            for (const field of suspectFields) {
                const testPayload = { ...fullPayload, email: `diag_${field}_${Date.now()}@test.local` };
                delete testPayload[field];
                const { data: d2, error: e2 } = await supabase
                    .from('users')
                    .insert(testPayload)
                    .select('id')
                    .maybeSingle();
                if (!e2 && d2) {
                    diagnostics[`without_${field}`] = 'SUCCESS - this field might be the problem';
                    await supabase.from('users').delete().eq('id', d2.id);
                    break;
                }
            }

            // Also try with minimal payload
            const minPayload = {
                email: `diag_min_${Date.now()}@test.local`,
                display_name: 'Min Test',
                show_in_public: false,
                is_banned: false,
                is_suspended: false,
                password_hash: 'test',
            };
            const { data: minData, error: minError } = await supabase
                .from('users')
                .insert(minPayload)
                .select('id')
                .maybeSingle();
            diagnostics.minimal_insert = minError
                ? { error: `${minError.code}: ${minError.message}` }
                : { ok: true, id: minData?.id };
            if (minData?.id) await supabase.from('users').delete().eq('id', minData.id);

        } else if (data) {
            diagnostics.full_insert = { ok: true, id: data.id };
            await supabase.from('users').delete().eq('id', data.id);
        } else {
            diagnostics.full_insert = { error: 'No data and no error returned' };
        }
    } catch (e) {
        diagnostics.full_insert = { error: `Exception: ${e.message}` };
    }

    // Step 2: Check total users
    try {
        const { count, error } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });
        diagnostics.total_users = error ? { error: error.message } : { count };
    } catch (e) {
        diagnostics.total_users = { error: e.message };
    }

    return NextResponse.json(diagnostics, { status: 200 });
}
