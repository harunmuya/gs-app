import { NextResponse } from 'next/server';

const WP_API_URL = process.env.NEXT_PUBLIC_WP_API_URL || 'https://genuinesugarmummies.co.ke/wp-json/wp/v2';

// GET: Fetch approved comments for a post
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const postId = searchParams.get('post');

        if (!postId) {
            return NextResponse.json({ error: 'Missing post parameter' }, { status: 400 });
        }

        const wpRes = await fetch(
            `${WP_API_URL}/comments?post=${postId}&per_page=50&orderby=date&order=desc&status=approve`,
            { next: { revalidate: 60 } } // Cache for 60 seconds
        );

        if (!wpRes.ok) {
            return NextResponse.json({ comments: [] });
        }

        const wpComments = await wpRes.json();

        const comments = wpComments.map(c => ({
            id: c.id,
            author: c.author_name || 'Anonymous',
            content: (c.content?.rendered || '').replace(/<[^>]+>/g, '').trim(),
            date: c.date,
            avatarUrl: c.author_avatar_urls?.['48'] || '',
        }));

        return NextResponse.json({ comments, total: comments.length });
    } catch (error) {
        console.error('Error fetching comments:', error);
        return NextResponse.json({ comments: [], total: 0 });
    }
}

// POST: Submit a new comment (goes to moderation)
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

        if (content.length > 1000) {
            return NextResponse.json(
                { error: 'Comment too long (max 1000 characters)' },
                { status: 400 }
            );
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authorEmail)) {
            return NextResponse.json(
                { error: 'Invalid email address' },
                { status: 400 }
            );
        }

        // Submit to WordPress REST API — will go to pending/moderation
        const wpRes = await fetch(`${WP_API_URL}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
            // Even if WP returns an error like "held for moderation", we still consider it success
            // WordPress may return 409 for duplicate comments or other statuses
            if (wpRes.status === 409) {
                return NextResponse.json({ success: true, status: 'hold', message: 'Comment submitted for moderation' });
            }
            return NextResponse.json(
                { error: 'Failed to submit comment. Please try again.' },
                { status: wpRes.status }
            );
        }

        const result = await wpRes.json();

        return NextResponse.json({
            success: true,
            status: result.status || 'hold',
            message: 'Comment submitted for moderation',
        });
    } catch (error) {
        console.error('Comment API error:', error);
        return NextResponse.json(
            { error: 'Failed to submit comment' },
            { status: 500 }
        );
    }
}
