import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Generate unique filename
        const ext = file.name?.split('.').pop() || 'jpg';
        const filename = `admin-upload-${Date.now()}-${Math.random().toString(36).substr(2, 6)}.${ext}`;
        const filePath = `avatars/${filename}`;

        // Upload to Supabase Storage
        const { data, error } = await supabaseAdmin.storage
            .from('photos')
            .upload(filePath, buffer, {
                contentType: file.type || 'image/jpeg',
                upsert: true,
            });

        if (error) {
            // Try alternate bucket name
            const { data: data2, error: error2 } = await supabaseAdmin.storage
                .from('avatars')
                .upload(filePath, buffer, {
                    contentType: file.type || 'image/jpeg',
                    upsert: true,
                });

            if (error2) {
                console.error('[Upload] Both buckets failed:', error.message, error2.message);
                return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 500 });
            }

            const { data: urlData } = supabaseAdmin.storage.from('avatars').getPublicUrl(filePath);
            return NextResponse.json({ url: urlData.publicUrl });
        }

        const { data: urlData } = supabaseAdmin.storage.from('photos').getPublicUrl(filePath);
        return NextResponse.json({ url: urlData.publicUrl });
    } catch (err) {
        console.error('[Upload API] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
