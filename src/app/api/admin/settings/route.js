import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        }
    }
);

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('app_settings')
            .select('*')
            .eq('key', 'campaigns')
            .single();

        if (error) {
            return NextResponse.json({
                bannerAds: true,
                intercomPromo: false,
                lockMessageLimit: true,
                dailySwipeLimit: true
            });
        }

        const value = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        return NextResponse.json(value);
    } catch {
        return NextResponse.json({
            bannerAds: true,
            intercomPromo: false,
            lockMessageLimit: true,
            dailySwipeLimit: true
        });
    }
}

export async function POST(request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('gs_admin_token')?.value;

        if (token !== 'authenticated-gs-admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        const { data, error } = await supabaseAdmin
            .from('app_settings')
            .upsert(
                {
                    key: 'campaigns',
                    value: body,
                    updated_at: new Date().toISOString()
                },
                { onConflict: 'key' }
            )
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, campaigns: data.value });
    } catch (err) {
        console.error('[Admin Settings API] Error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
