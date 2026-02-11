import { NextResponse } from 'next/server';

const WP_API_URL = process.env.NEXT_PUBLIC_WP_API_URL || 'https://genuinesugarmummies.co.ke/wp-json/wp/v2';

export async function POST(request) {
    try {
        const body = await request.json();
        const { postId, authorName, authorEmail, content } = body;

        if (!postId || !content || !authorName || !authorEmail) {
            return NextResponse.json(
                { error: 'Missing required fields: postId, authorName, authorEmail, content' },
                { status: 400 }
            );
        }

        // Validate content length
        if (content.length > 1000) {
            return NextResponse.json(
                { error: 'Comment too long (max 1000 characters)' },
                { status: 400 }
            );
        }

        // Simple email validation
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authorEmail)) {
            return NextResponse.json(
                { error: 'Invalid email address' },
                { status: 400 }
            );
        }

        // Submit to WordPress REST API
        // Comments will be submitted as pending (await moderation)
        const wpRes = await fetch(`${WP_API_URL}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                post: postId,
                author_name: authorName,
                author_email: authorEmail,
                content: content,
            }),
        });

        if (!wpRes.ok) {
            const errorData = await wpRes.text();
            console.error('WordPress comment error:', errorData);
            return NextResponse.json(
                { error: 'Failed to submit comment. It may need admin approval.' },
                { status: wpRes.status }
            );
        }

        const result = await wpRes.json();

        return NextResponse.json({
            success: true,
            status: result.status || 'pending',
            message: 'Comment submitted for approval',
        });
    } catch (error) {
        console.error('Comment API error:', error);
        return NextResponse.json(
            { error: 'Failed to submit comment' },
            { status: 500 }
        );
    }
}
