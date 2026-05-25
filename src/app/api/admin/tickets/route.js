import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

async function verifyAdmin() {
    const cookieStore = await cookies();
    const token = cookieStore.get('gs_admin_token')?.value;
    return token === 'authenticated-gs-admin';
}

// GET all tickets (admin)
export async function GET(request) {
    if (!await verifyAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const category = searchParams.get('category');

        let query = supabaseAdmin
            .from('support_tickets')
            .select('*, users(display_name, email, avatar_url, id)')
            .order('created_at', { ascending: false })
            .limit(100);

        if (status && status !== 'all') query = query.eq('status', status);
        if (category && category !== 'all') query = query.eq('category', category);

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json({ tickets: data || [] });
    } catch (err) {
        console.error('[Tickets GET]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST — reply to ticket or update status (admin)
export async function POST(request) {
    if (!await verifyAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { action, ticketId, status, adminReply } = body;

        if (!ticketId) return NextResponse.json({ error: 'Ticket ID required' }, { status: 400 });

        const updates = { updated_at: new Date().toISOString() };
        if (status) updates.status = status;
        if (adminReply) updates.admin_reply = adminReply;

        const { data, error } = await supabaseAdmin
            .from('support_tickets')
            .update(updates)
            .eq('id', ticketId)
            .select('*, users(display_name, email)')
            .single();

        if (error) throw error;

        // Send notification to user if replied
        if (adminReply && data?.user_id) {
            await supabaseAdmin.from('notifications').insert({
                user_id: data.user_id,
                type: 'support',
                sender: 'GS Support',
                sender_image: '/gs-logo.png',
                title: '📩 Support Reply',
                body: `Your ticket "${data.subject}" has been responded to by our team. Status: ${updates.status || data.status}.`,
                is_read: false,
            }).catch(e => console.warn('[Tickets] Notify failed:', e.message));
        }

        return NextResponse.json({ success: true, ticket: data });
    } catch (err) {
        console.error('[Tickets POST]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
