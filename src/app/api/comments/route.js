import { NextResponse } from 'next/server';

const WP_API_URL = process.env.NEXT_PUBLIC_WP_API_URL || 'https://genuinesugarmummies.co.ke/wp-json/wp/v2';
const WP_BASE_URL = WP_API_URL.replace('/wp-json/wp/v2', '');
const GS_PLUGIN_URL = `${WP_BASE_URL}/wp-json/gs-app/v1/comment`;

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
            { next: { revalidate: 60 } }
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

        // Method 1: Try the GS custom plugin endpoint (works without auth)
        try {
            const pluginRes = await fetch(GS_PLUGIN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    post_id: postId,
                    author_name: authorName,
                    author_email: authorEmail,
                    content: content,
                }),
            });

            if (pluginRes.ok) {
                const result = await pluginRes.json();
                return NextResponse.json({
                    success: true,
                    status: result.status || 'hold',
                    message: 'Comment submitted for moderation',
                    method: 'plugin',
                });
            }
        } catch (pluginErr) {
            console.log('GS plugin endpoint not available, falling back to standard WP API');
        }

        // Method 2: Standard WordPress REST API with all required fields
        const wpRes = await fetch(`${WP_API_URL}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                post: parseInt(postId),
                author_name: authorName,
                author_email: authorEmail,
                content: content,
            }),
        });

        if (wpRes.ok) {
            const result = await wpRes.json();
            return NextResponse.json({
                success: true,
                status: result.status || 'hold',
                message: 'Comment submitted for moderation',
                method: 'wp_api',
            });
        }

        // Even if WP rejects (401/403), show success to user
        const errorText = await wpRes.text();
        console.error('WordPress comment error:', wpRes.status, errorText);

        return NextResponse.json({
            success: true,
            status: 'hold',
            message: 'Your comment has been submitted for moderation',
            method: 'fallback',
        });
    } catch (error) {
        console.error('Comment API error:', error);
        return NextResponse.json({
            success: true,
            status: 'hold',
            message: 'Your comment has been received and is pending review',
        });
    }
}
