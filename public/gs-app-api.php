<?php
/**
 * Plugin Name: GS App API
 * Plugin URI: https://genuinesugarmummies.co.ke
 * Description: Combined REST API for the Genuine Sugarmummies App — provides optimized profiles endpoint and comment submission in one plugin.
 * Version: 2.0.0
 * Author: GS Admin
 * License: GPL-2.0+
 *
 * ENDPOINTS:
 *   GET  /wp-json/gs-app/v1/profiles          → All profiles (paginated, with images + comment counts)
 *   GET  /wp-json/gs-app/v1/profiles/{id}      → Single profile by post ID
 *   GET  /wp-json/gs-app/v1/comments/{post_id} → Approved comments for a post
 *   POST /wp-json/gs-app/v1/comment             → Submit a new comment (pending moderation)
 *
 * INSTALLATION:
 *   1. Upload this file via WordPress Dashboard → Plugins → Add New → Upload Plugin (as ZIP)
 *   2. Activate the plugin
 */

if (!defined('ABSPATH')) exit;

// ============================================================
// REGISTER ALL REST ROUTES
// ============================================================
add_action('rest_api_init', function () {

    // ---- GET /profiles ----
    register_rest_route('gs-app/v1', '/profiles', array(
        'methods'             => 'GET',
        'callback'            => 'gs_app_get_profiles',
        'permission_callback' => '__return_true',
        'args'                => array(
            'page'     => array('default' => 1,  'sanitize_callback' => 'absint'),
            'per_page' => array('default' => 25, 'sanitize_callback' => 'absint'),
        ),
    ));

    // ---- GET /profiles/{id} ----
    register_rest_route('gs-app/v1', '/profiles/(?P<id>\d+)', array(
        'methods'             => 'GET',
        'callback'            => 'gs_app_get_single_profile',
        'permission_callback' => '__return_true',
    ));

    // ---- GET /comments/{post_id} ----
    register_rest_route('gs-app/v1', '/comments/(?P<post_id>\d+)', array(
        'methods'             => 'GET',
        'callback'            => 'gs_app_get_comments',
        'permission_callback' => '__return_true',
    ));

    // ---- POST /comment ----
    register_rest_route('gs-app/v1', '/comment', array(
        'methods'             => 'POST',
        'callback'            => 'gs_app_submit_comment',
        'permission_callback' => '__return_true',
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

// Also allow anonymous comments on default WP REST
add_filter('rest_allow_anonymous_comments', '__return_true');


// ============================================================
// PROFILES ENDPOINT — Optimized single query
// ============================================================
function gs_app_get_profiles($request) {
    $page     = max(1, (int) $request->get_param('page'));
    $per_page = min(100, max(1, (int) $request->get_param('per_page')));

    $args = array(
        'post_type'      => 'post',
        'post_status'    => 'publish',
        'posts_per_page' => $per_page,
        'paged'          => $page,
        'orderby'        => 'date',
        'order'          => 'DESC',
    );

    $query = new WP_Query($args);
    $profiles = array();

    foreach ($query->posts as $post) {
        $profile = gs_app_build_profile($post);
        if ($profile) {
            $profiles[] = $profile;
        }
    }

    $response = rest_ensure_response(array(
        'profiles'   => $profiles,
        'page'       => $page,
        'per_page'   => $per_page,
        'totalPosts' => (int) $query->found_posts,
        'totalPages' => (int) $query->max_num_pages,
    ));

    // Cache for 5 minutes on CDN/browser
    $response->header('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    $response->header('Access-Control-Allow-Origin', '*');

    return $response;
}


// ============================================================
// SINGLE PROFILE ENDPOINT
// ============================================================
function gs_app_get_single_profile($request) {
    $post_id = (int) $request['id'];
    $post = get_post($post_id);

    if (!$post || $post->post_status !== 'publish') {
        return new WP_Error('not_found', 'Profile not found.', array('status' => 404));
    }

    $profile = gs_app_build_profile($post);
    if (!$profile) {
        return new WP_Error('not_found', 'Profile not found.', array('status' => 404));
    }

    // Also include approved comments inline
    $comments = get_comments(array(
        'post_id' => $post_id,
        'status'  => 'approve',
        'orderby' => 'comment_date',
        'order'   => 'DESC',
        'number'  => 50,
    ));

    $comment_list = array();
    foreach ($comments as $c) {
        $comment_list[] = array(
            'id'        => (int) $c->comment_ID,
            'author'    => $c->comment_author,
            'content'   => wp_strip_all_tags($c->comment_content),
            'date'      => $c->comment_date,
            'avatarUrl' => get_avatar_url($c->comment_author_email, array('size' => 48)),
        );
    }

    $profile['comments'] = $comment_list;

    $response = rest_ensure_response(array('profiles' => array($profile)));
    $response->header('Cache-Control', 'public, max-age=120, s-maxage=120, stale-while-revalidate=300');
    $response->header('Access-Control-Allow-Origin', '*');

    return $response;
}


// ============================================================
// COMMENTS ENDPOINT — Get approved comments for a post
// ============================================================
function gs_app_get_comments($request) {
    $post_id = (int) $request['post_id'];

    $post = get_post($post_id);
    if (!$post || $post->post_status !== 'publish') {
        return new WP_Error('not_found', 'Post not found.', array('status' => 404));
    }

    $comments = get_comments(array(
        'post_id' => $post_id,
        'status'  => 'approve',
        'orderby' => 'comment_date',
        'order'   => 'DESC',
        'number'  => 100,
    ));

    $comment_list = array();
    foreach ($comments as $c) {
        $comment_list[] = array(
            'id'        => (int) $c->comment_ID,
            'author'    => $c->comment_author,
            'content'   => wp_strip_all_tags($c->comment_content),
            'date'      => $c->comment_date,
            'avatarUrl' => get_avatar_url($c->comment_author_email, array('size' => 48)),
        );
    }

    $response = rest_ensure_response(array('comments' => $comment_list));
    $response->header('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=120');
    $response->header('Access-Control-Allow-Origin', '*');

    return $response;
}


// ============================================================
// COMMENT SUBMISSION — Accept without auth, hold for moderation
// ============================================================
function gs_app_submit_comment($request) {
    $post_id      = $request->get_param('post_id');
    $author_name  = $request->get_param('author_name');
    $author_email = $request->get_param('author_email');
    $content      = $request->get_param('content');

    // Verify post exists
    $post = get_post($post_id);
    if (!$post || $post->post_status !== 'publish') {
        return new WP_Error('invalid_post', 'The specified post does not exist or is not published.', array('status' => 404));
    }

    // Content length check
    if (strlen($content) > 2000) {
        return new WP_Error('content_too_long', 'Comment content exceeds 2000 characters.', array('status' => 400));
    }

    // Insert comment
    $comment_id = wp_insert_comment(array(
        'comment_post_ID'      => $post_id,
        'comment_author'       => $author_name,
        'comment_author_email' => $author_email,
        'comment_content'      => $content,
        'comment_type'         => 'comment',
        'comment_approved'     => 0, // pending moderation
        'comment_date'         => current_time('mysql'),
        'comment_date_gmt'     => current_time('mysql', 1),
        'comment_author_IP'    => $_SERVER['REMOTE_ADDR'] ?? '',
        'comment_agent'        => 'GS-App/2.0',
    ));

    if (!$comment_id) {
        return new WP_Error('comment_failed', 'Failed to create comment.', array('status' => 500));
    }

    wp_notify_moderator($comment_id);

    return rest_ensure_response(array(
        'success'    => true,
        'comment_id' => $comment_id,
        'status'     => 'hold',
        'message'    => 'Comment submitted for moderation.',
    ));
}


// ============================================================
// HELPER — Build profile data from a WP_Post object
// ============================================================
function gs_app_build_profile($post) {
    // Get featured image
    $image_url = '';
    $thumb_id = get_post_thumbnail_id($post->ID);
    if ($thumb_id) {
        $img = wp_get_attachment_image_src($thumb_id, 'large');
        if ($img) $image_url = $img[0];
    }

    // Try Jetpack CDN image
    if (empty($image_url)) {
        $jetpack_url = get_post_meta($post->ID, '_jetpack_featured_media_url', true);
        if ($jetpack_url) $image_url = $jetpack_url;
    }

    // Fallback: extract first image from content
    if (empty($image_url)) {
        if (preg_match('/<img[^>]+src=["\']([^"\']+)["\']/', $post->post_content, $matches)) {
            $image_url = $matches[1];
        }
    }

    // Only return profiles with some image
    // But allow profiles even without images now (just give empty string)

    // Comment count
    $comment_count = (int) get_comments_number($post->ID);

    // Clean content
    $content_raw = wp_strip_all_tags($post->post_content);
    $excerpt_raw = wp_strip_all_tags($post->post_excerpt ?: $post->post_content);
    $excerpt_raw = preg_replace('/continue\s+reading.*/i', '', $excerpt_raw);
    $excerpt_raw = preg_replace('/&hellip;/', '...', $excerpt_raw);
    $excerpt_raw = trim(mb_substr($excerpt_raw, 0, 300));

    return array(
        'wpId'         => (int) $post->ID,
        'title'        => html_entity_decode(wp_strip_all_tags($post->post_title), ENT_QUOTES, 'UTF-8'),
        'excerpt'      => $excerpt_raw,
        'content'      => apply_filters('the_content', $post->post_content),
        'imageUrl'     => $image_url,
        'date'         => $post->post_date,
        'link'         => get_permalink($post->ID),
        'commentCount' => $comment_count,
    );
}
