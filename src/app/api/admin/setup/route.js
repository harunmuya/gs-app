import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

export async function POST(request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('gs_admin_token')?.value;
        if (token !== 'authenticated-gs-admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const results = {};

        // 1. Create payment-proofs bucket (public read, authenticated write)
        const { data: bucket1, error: err1 } = await supabaseAdmin.storage.createBucket('payment-proofs', {
            public: false,
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            fileSizeLimit: 5 * 1024 * 1024, // 5MB
        });
        results.paymentProofs = err1?.message?.includes('already exists') ? 'exists' : (err1 ? err1.message : 'created');

        // 2. Create verification-docs bucket (private)
        const { data: bucket2, error: err2 } = await supabaseAdmin.storage.createBucket('verification-docs', {
            public: false,
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
            fileSizeLimit: 10 * 1024 * 1024, // 10MB
        });
        results.verificationDocs = err2?.message?.includes('already exists') ? 'exists' : (err2 ? err2.message : 'created');

        // 3. Create avatars bucket (public)
        const { data: bucket3, error: err3 } = await supabaseAdmin.storage.createBucket('avatars', {
            public: true,
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            fileSizeLimit: 5 * 1024 * 1024,
        });
        results.avatars = err3?.message?.includes('already exists') ? 'exists' : (err3 ? err3.message : 'created');

        // 4. Run schema migrations for new tables
        const schemaSql = `
            -- Support tickets table
            CREATE TABLE IF NOT EXISTS support_tickets (
                id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
                user_id uuid REFERENCES users(id) ON DELETE CASCADE,
                category text NOT NULL DEFAULT 'other',
                subject text NOT NULL,
                message text NOT NULL,
                status text NOT NULL DEFAULT 'open',
                admin_reply text,
                created_at timestamptz DEFAULT now(),
                updated_at timestamptz DEFAULT now()
            );

            -- Add payment proof URL to transactions if not already there
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_proof_url text;
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS admin_notes text;
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
            ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reviewed_by text;

            -- Add last_seen to users if not already there
            ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen timestamptz DEFAULT now();

            -- RLS for support_tickets
            ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

            -- Drop policies if exist then recreate
            DROP POLICY IF EXISTS "Users can view own tickets" ON support_tickets;
            DROP POLICY IF EXISTS "Users can insert own tickets" ON support_tickets;
            DROP POLICY IF EXISTS "Service role full access tickets" ON support_tickets;

            CREATE POLICY "Users can view own tickets" ON support_tickets
                FOR SELECT USING (auth.uid() = user_id);

            CREATE POLICY "Users can insert own tickets" ON support_tickets
                FOR INSERT WITH CHECK (auth.uid() = user_id);

            CREATE POLICY "Service role full access tickets" ON support_tickets
                USING (true) WITH CHECK (true);
        `;

        // Execute the schema via RPC or direct SQL
        try {
            const { error: sqlErr } = await supabaseAdmin.rpc('exec_sql', { sql: schemaSql });
            results.schema = sqlErr ? `rpc_failed: ${sqlErr.message}` : 'applied';
        } catch (rpcErr) {
            // Try alternate method
            results.schema = `rpc_unavailable - run schema manually: ${rpcErr.message}`;
        }

        return NextResponse.json({
            success: true,
            message: 'Storage buckets setup complete',
            results,
        });
    } catch (err) {
        console.error('[Storage Setup]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// Upload signed URL for payment proofs — auto-creates bucket if missing
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const filename = searchParams.get('filename');
        const bucket = searchParams.get('bucket') || 'payment-proofs';

        if (!userId || !filename) {
            return NextResponse.json({ error: 'userId and filename required' }, { status: 400 });
        }

        // Ensure the bucket exists and is public before trying to generate a signed URL
        await ensureBucketExists(bucket);

        const path = `${userId}/${Date.now()}_${filename}`;
        const { data, error } = await supabaseAdmin.storage
            .from(bucket)
            .createSignedUploadUrl(path);

        if (error) {
            console.error('[Storage Upload URL] Signed URL error:', error.message);
            // If signed URL fails, return fallback mode
            return NextResponse.json({ 
                fallbackMode: true, 
                path,
                message: 'Use base64 upload instead' 
            });
        }

        return NextResponse.json({ signedUrl: data.signedUrl, path, token: data.token });
    } catch (err) {
        console.error('[Storage Upload URL]', err);
        return NextResponse.json({ 
            fallbackMode: true, 
            path: `${Date.now()}_fallback`,
            message: err.message 
        });
    }
}

// Helper to auto-create bucket if it does not exist
async function ensureBucketExists(bucketName) {
    try {
        const { data, error } = await supabaseAdmin.storage.getBucket(bucketName);
        if (error && (error.message?.includes('not found') || error.statusCode === 404 || error.message?.includes('does not exist'))) {
            console.log(`[Storage] Creating missing bucket: ${bucketName}`);
            await supabaseAdmin.storage.createBucket(bucketName, {
                public: true, // Make public so direct rendering works without signing
                allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
                fileSizeLimit: 10 * 1024 * 1024, // 10MB
            });
        }
    } catch (e) {
        console.warn('[Storage] ensureBucketExists failed:', e.message);
    }
}

// POST endpoint for base64 payment proof/verifications upload (fallback when signed URL fails)
export async function PUT(request) {
    try {
        const body = await request.json();
        const { userId, filename, base64Data, mimeType, bucket = 'payment-proofs' } = body;

        if (!userId || !base64Data) {
            return NextResponse.json({ error: 'userId and base64Data required' }, { status: 400 });
        }

        await ensureBucketExists(bucket);

        // Decode base64 to buffer
        const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Clean, 'base64');
        const path = `${userId}/${Date.now()}_${filename || 'upload.jpg'}`;

        const { data, error } = await supabaseAdmin.storage
            .from(bucket)
            .upload(path, buffer, {
                contentType: mimeType || 'image/jpeg',
                upsert: false,
            });

        if (error) {
            console.error('[Storage Base64 Upload] Error:', error.message);
            return NextResponse.json({ 
                fallbackMode: true,
                base64Stored: true,
                path,
                message: 'Upload failed, falling back to database save'
            });
        }

        const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
        return NextResponse.json({ success: true, url: publicUrl, path });
    } catch (err) {
        console.error('[Storage Base64 Upload]', err);
        return NextResponse.json({ 
            fallbackMode: true,
            base64Stored: true,
            message: err.message 
        });
    }
}
