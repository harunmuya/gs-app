import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

// DELETE broken/duplicate seed users (no phone_number, is_seed=false but gs-seed email)
export async function DELETE() {
    try {
        // Find all users with gs-seed emails that are NOT properly seeded
        const { data: allUsers } = await supabaseAdmin
            .from('users')
            .select('id, email, is_seed, phone_number, display_name')
            .like('email', '%@gs-seed.app');

        const broken = (allUsers || []).filter(u => !u.phone_number || !u.is_seed);

        let deleted = 0;
        for (const user of broken) {
            // Delete from auth (cascades to public.users)
            const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
            if (!error) deleted++;
        }

        return NextResponse.json({
            success: true,
            message: `Cleaned up ${deleted} broken seed profiles`,
            found: broken.length,
            deleted,
            kept: (allUsers || []).length - broken.length,
        });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
