import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ADMIN_EMAIL = 'admin@genuinesugarmummies.co.ke';
const ADMIN_PASSWORD = 'GSAdminSecure2026!';
const TOKEN_VALUE = 'authenticated-gs-admin';

export async function POST(request) {
    try {
        const { email, password } = await request.json();

        if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
            const cookieStore = await cookies();
            cookieStore.set('gs_admin_token', TOKEN_VALUE, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                path: '/',
                maxAge: 60 * 60 * 24, // 1 day
                sameSite: 'lax',
            });

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid admin credentials' }, { status: 401 });
    } catch (err) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE() {
    const cookieStore = await cookies();
    cookieStore.delete('gs_admin_token');
    return NextResponse.json({ success: true });
}

// Support GET for session verification
export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get('gs_admin_token')?.value;

    if (token === TOKEN_VALUE) {
        return NextResponse.json({ authenticated: true });
    }

    return NextResponse.json({ authenticated: false }, { status: 401 });
}
