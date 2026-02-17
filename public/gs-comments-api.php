<?php
/**
 * Plugin Name: GS Comments API
 * Plugin URI: https://genuinesugarmummies.co.ke
 * Description: Custom REST API endpoint for accepting comments from the Genuine Sugarmummies app without authentication.
 * Version: 1.0.0
 * Author: GS Admin
 * License: GPL-2.0+
 *
 * INSTALLATION:
 * 1. Create a folder called "gs-comments-api" in wp-content/plugins/
 * 2. Place this file inside that folder
 * 3. Activate the plugin from WordPress Dashboard → Plugins
 *
 * This plugin registers: POST /wp-json/gs-app/v1/comment
 * It accepts: post_id, author_name, author_email, content
 * Comments are created with status "hold" (pending moderation)
 */

if (!defined('ABSPATH')) exit;

add_action('rest_api_init', function () {
    register_rest_route('gs-app/v1', '/comment', array(
        'methods'             => 'POST',
        'callback'            => 'gs_app_submit_comment',
        'permission_callback' => '__return_true', // Allow unauthenticated access
        'args'                => array(
            'post_id' => array(
                'required'          => true,
                'type'              => 'integer',
                'sanitize_callback' => 'absint',
            ),
            'author_name' => array(
                'required'          => true,
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ),
            'author_email' => array(
                'required'          => true,
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_email',
                'validate_callback' => function ($value) {
                    return is_email($value);
                },
            ),
            'content' => array(
                'required'          => true,
                'type'              => 'string',
                'sanitize_callback' => 'wp_kses_post',
            ),
        ),
    ));
});

function gs_app_submit_comment($request) {
    $post_id      = $request->get_param('post_id');
    $author_name  = $request->get_param('author_name');
    $author_email = $request->get_param('author_email');
    $content      = $request->get_param('content');

    // Verify the post exists
    $post = get_post($post_id);
    if (!$post || $post->post_status !== 'publish') {
        return new WP_Error(
            'invalid_post',
            'The specified post does not exist or is not published.',
            array('status' => 404)
        );
    }

    // Validate content length
    if (strlen($content) > 2000) {
        return new WP_Error(
            'content_too_long',
            'Comment content exceeds maximum length of 2000 characters.',
            array('status' => 400)
        );
    }

    // Prepare comment data
    $comment_data = array(
        'comment_post_ID'      => $post_id,
        'comment_author'       => $author_name,
        'comment_author_email' => $author_email,
        'comment_content'      => $content,
        'comment_type'         => 'comment',
        'comment_approved'     => 0, // 0 = hold/pending moderation
        'comment_date'         => current_time('mysql'),
        'comment_date_gmt'     => current_time('mysql', 1),
        'comment_author_IP'    => $_SERVER['REMOTE_ADDR'] ?? '',
        'comment_agent'        => 'GS-App/1.0',
    );

    // Insert the comment
    $comment_id = wp_insert_comment($comment_data);

    if (!$comment_id) {
        return new WP_Error(
            'comment_failed',
            'Failed to create comment.',
            array('status' => 500)
        );
    }

    // Notify admin of new comment (optional, WP handles this if configured)
    wp_notify_moderator($comment_id);

    return rest_ensure_response(array(
        'success'    => true,
        'comment_id' => $comment_id,
        'status'     => 'hold',
        'message'    => 'Comment submitted for moderation. It will appear after admin approval.',
    ));
}

/**
 * Also ensure that the default WP REST comments endpoint allows
 * comments without authentication by filtering the permission check.
 */
add_filter('rest_allow_anonymous_comments', '__return_true');
