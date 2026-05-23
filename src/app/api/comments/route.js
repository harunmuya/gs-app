import { NextResponse } from 'next/server';
import { fetchComments, submitComment } from '@/lib/wordpress';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('post');

    if (!postId) {
        return NextResponse.json({ error: 'Missing post parameter' }, { status: 400 });
    }

    try {
        const comments = await fetchComments(postId);
        return NextResponse.json(
            { comments },
            {
                headers: {
                    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
                },
            }
        );
    } catch (error) {
        console.error('[Comments API] GET error:', error.message);
        return NextResponse.json(
            { error: 'Failed to fetch comments', comments: [] },
            { status: 500 }
        );
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { post_id, author_name, author_email, content } = body;

        // Validation
        if (!post_id || !content?.trim()) {
            return NextResponse.json({ error: 'Post ID and content are required' }, { status: 400 });
        }
        if (author_name && author_name.trim().length < 2) {
            return NextResponse.json({ error: 'Name must be at least 2 characters' }, { status: 400 });
        }
        if (author_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(author_email)) {
            return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
        }
        if (content.trim().length > 1000) {
            return NextResponse.json({ error: 'Comment must be under 1000 characters' }, { status: 400 });
        }

        const result = await submitComment({
            post_id,
            author_name: (author_name || 'Anonymous').trim(),
            author_email: (author_email || '').trim(),
            content: content.trim(),
        });

        if (!result || result.error) {
            return NextResponse.json(
                { error: result?.error || 'Failed to submit comment. Please try again.' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            comment_id: result.comment_id || result.id,
            message: 'Your comment has been submitted for moderation.',
        });
    } catch (error) {
        console.error('[Comments API] POST error:', error.message);
        return NextResponse.json(
            { error: 'Failed to submit comment. Please try again later.' },
            { status: 500 }
        );
    }
}
