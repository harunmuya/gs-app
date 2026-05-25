import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

// POST — user submits a support ticket
export async function POST(request) {
    try {
        const body = await request.json();
        const { userId, category, subject, message } = body;

        if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        if (!category) return NextResponse.json({ error: 'Category required' }, { status: 400 });
        if (!subject?.trim()) return NextResponse.json({ error: 'Subject required' }, { status: 400 });
        if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 });

        // Rate limit: max 3 open tickets per user
        const { count } = await supabaseAdmin
            .from('support_tickets')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .in('status', ['open', 'in_progress']);

        if (count >= 5) {
            return NextResponse.json({ error: 'You have too many open tickets. Please wait for existing ones to be resolved.' }, { status: 429 });
        }

        const { data, error } = await supabaseAdmin
            .from('support_tickets')
            .insert({
                user_id: userId,
                category,
                subject: subject.trim(),
                message: message.trim(),
                status: 'open',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) throw error;

        // Confirm receipt notification
        await supabaseAdmin.from('notifications').insert({
            user_id: userId,
            type: 'support',
            sender: 'GS Support',
            sender_image: '/gs-logo.png',
            title: '✅ Ticket Received',
            body: `Your support ticket "${subject.trim()}" has been submitted. Our team will respond within 24 hours.`,
            is_read: false,
        }).catch(() => {});

        return NextResponse.json({ success: true, ticket: data });
    } catch (err) {
        console.error('[Support POST]', err);
        return NextResponse.json({ error: err.message || 'Failed to submit ticket' }, { status: 500 });
    }
}

// GET — user views their own tickets
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

        const { data, error } = await supabaseAdmin
            .from('support_tickets')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;
        return NextResponse.json({ tickets: data || [] });
    } catch (err) {
        console.error('[Support GET]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
