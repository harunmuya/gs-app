<?php
/**
 * Plugin Name: GS App API
 * Plugin URI: https://genuinesugarmummies.co.ke
 * Description: Combined REST API for the Genuine Sugarmummies App — profiles, comments, and email subscriptions.
 * Version: 3.0.0
 * Author: GS Admin
 * License: GPL-2.0+
 *
 * ENDPOINTS:
 *   GET  /wp-json/gs-app/v1/profiles          → All profiles (paginated)
 *   GET  /wp-json/gs-app/v1/profiles/{id}      → Single profile with inline comments
 *   GET  /wp-json/gs-app/v1/comments/{post_id} → Approved comments for a post
 *   POST /wp-json/gs-app/v1/comment             → Submit comment (pending moderation)
 *   POST /wp-json/gs-app/v1/subscribe           → Subscribe email for notifications
 *   GET  /wp-json/gs-app/v1/verify-email        → Confirm email subscription
 */

if (!defined('ABSPATH')) exit;

// ============================================================
// ACTIVATION — Create subscribers table
// ============================================================
register_activation_hook(__FILE__, 'gs_app_activate');
function gs_app_activate() {
    global $wpdb;
    $table = $wpdb->prefix . 'gs_subscribers';
    $charset = $wpdb->get_charset_collate();

    $sql = "CREATE TABLE IF NOT EXISTS $table (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        email VARCHAR(191) NOT NULL,
        name VARCHAR(100) DEFAULT '',
        token VARCHAR(64) NOT NULL,
        confirmed TINYINT(1) DEFAULT 0,
        verified_user TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY email (email),
        KEY token (token)
    ) $charset;";

    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);

    // Rate limit transient cleanup is automatic
    update_option('gs_app_db_version', '3.0.0');
}


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

    // ---- POST /comment (rate-limited) ----
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
            // Honeypot field — should be empty
            'website' => array(
                'required' => false,
                'type'     => 'string',
                'default'  => '',
            ),
        ),
    ));

    // ---- POST /subscribe ----
    register_rest_route('gs-app/v1', '/subscribe', array(
        'methods'             => 'POST',
        'callback'            => 'gs_app_subscribe',
        'permission_callback' => '__return_true',
        'args'                => array(
            'email' => array(
                'required'          => true,
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_email',
                'validate_callback' => function ($v) { return is_email($v); },
            ),
            'name' => array(
                'required'          => false,
                'type'              => 'string',
                'default'           => '',
                'sanitize_callback' => 'sanitize_text_field',
            ),
            'is_verified' => array(
                'required' => false,
                'type'     => 'boolean',
                'default'  => false,
            ),
        ),
    ));

    // ---- GET /verify-email ----
    register_rest_route('gs-app/v1', '/verify-email', array(
        'methods'             => 'GET',
        'callback'            => 'gs_app_verify_email',
        'permission_callback' => '__return_true',
        'args'                => array(
            'token' => array('required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
        ),
    ));
});

// Also allow anonymous comments on default WP REST
add_filter('rest_allow_anonymous_comments', '__return_true');


// ============================================================
// RATE LIMITER — Max 5 actions per IP per 10 minutes
// ============================================================
function gs_app_rate_check($action = 'comment', $max = 5, $window = 600) {
    $ip = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    $key = 'gs_rate_' . $action . '_' . md5($ip);
    $count = (int) get_transient($key);
    if ($count >= $max) {
        return false; // Rate limited
    }
    set_transient($key, $count + 1, $window);
    return true;
}


// ============================================================
// PROFILES ENDPOINT
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
// COMMENTS ENDPOINT
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
// COMMENT SUBMISSION — Rate limited + honeypot spam check
// ============================================================
function gs_app_submit_comment($request) {
    // Honeypot spam check — bots fill the hidden "website" field
    $honeypot = $request->get_param('website');
    if (!empty($honeypot)) {
        // Pretend success to confuse bots
        return rest_ensure_response(array(
            'success'    => true,
            'comment_id' => 0,
            'status'     => 'hold',
            'message'    => 'Comment submitted for moderation.',
        ));
    }

    // Rate limit: 5 comments per 10 minutes per IP
    if (!gs_app_rate_check('comment', 5, 600)) {
        return new WP_Error('rate_limited', 'Too many comments. Please wait a few minutes.', array('status' => 429));
    }

    $post_id      = $request->get_param('post_id');
    $author_name  = $request->get_param('author_name');
    $author_email = $request->get_param('author_email');
    $content      = $request->get_param('content');

    // Verify post exists
    $post = get_post($post_id);
    if (!$post || $post->post_status !== 'publish') {
        return new WP_Error('invalid_post', 'The specified post does not exist.', array('status' => 404));
    }

    // Content length check
    if (strlen($content) > 2000) {
        return new WP_Error('content_too_long', 'Comment exceeds 2000 characters.', array('status' => 400));
    }

    // Insert comment — held for moderation
    $comment_id = wp_insert_comment(array(
        'comment_post_ID'      => $post_id,
        'comment_author'       => $author_name,
        'comment_author_email' => $author_email,
        'comment_content'      => $content,
        'comment_type'         => 'comment',
        'comment_approved'     => 0,
        'comment_date'         => current_time('mysql'),
        'comment_date_gmt'     => current_time('mysql', 1),
        'comment_author_IP'    => sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? ''),
        'comment_agent'        => 'GS-App/3.0',
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
// EMAIL SUBSCRIPTION
// ============================================================
function gs_app_subscribe($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'gs_subscribers';

    if (!gs_app_rate_check('subscribe', 3, 600)) {
        return new WP_Error('rate_limited', 'Too many requests. Please wait.', array('status' => 429));
    }

    $email  = $request->get_param('email');
    $name   = $request->get_param('name') ?: '';
    $is_verified = (bool) $request->get_param('is_verified');

    // Check if already subscribed
    $existing = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE email = %s", $email));
    if ($existing) {
        if ($existing->confirmed) {
            return rest_ensure_response(array(
                'success' => true,
                'message' => 'You are already subscribed to updates!',
                'already_subscribed' => true,
            ));
        }
        // Resend verification
        gs_app_send_verification($email, $existing->name, $existing->token);
        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Verification email resent. Check your inbox.',
        ));
    }

    // Generate token and insert
    $token = wp_generate_password(32, false);

    $wpdb->insert($table, array(
        'email'         => $email,
        'name'          => $name,
        'token'         => $token,
        'confirmed'     => 0,
        'verified_user' => $is_verified ? 1 : 0,
        'created_at'    => current_time('mysql'),
    ));

    // Send verification email
    gs_app_send_verification($email, $name, $token);

    return rest_ensure_response(array(
        'success' => true,
        'message' => 'Check your email to confirm your subscription!',
    ));
}

function gs_app_send_verification($email, $name, $token) {
    $verify_url = rest_url('gs-app/v1/verify-email') . '?token=' . urlencode($token);
    $site_name  = get_bloginfo('name');
    $greeting   = $name ? "Hi $name," : "Hi,";

    $subject = "Confirm your subscription — $site_name";

    $body = "<!DOCTYPE html><html><body style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;'>
        <div style='text-align:center;padding:20px 0;'>
            <h1 style='color:#EA580C;margin:0;font-size:24px;'>$site_name</h1>
            <p style='color:#666;font-size:14px;'>Kenya's #1 Dating Platform</p>
        </div>
        <div style='background:#f9f9f9;border-radius:12px;padding:24px;'>
            <p style='font-size:16px;color:#333;'>$greeting</p>
            <p style='color:#555;line-height:1.6;'>Thanks for subscribing! Please confirm your email to start receiving notifications when new profiles are posted.</p>
            <div style='text-align:center;margin:24px 0;'>
                <a href='$verify_url' style='display:inline-block;background:#EA580C;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;'>Confirm Subscription</a>
            </div>
            <p style='color:#888;font-size:12px;'>If you didn't request this, you can safely ignore this email.</p>
        </div>
        <p style='text-align:center;color:#999;font-size:11px;margin-top:20px;'>© " . date('Y') . " $site_name — All rights reserved.</p>
    </body></html>";

    $headers = array(
        'Content-Type: text/html; charset=UTF-8',
        'From: ' . $site_name . ' <no-reply@' . parse_url(home_url(), PHP_URL_HOST) . '>',
        'Reply-To: admin@' . parse_url(home_url(), PHP_URL_HOST),
        'List-Unsubscribe: <' . home_url('/unsubscribe') . '>',
    );

    wp_mail($email, $subject, $body, $headers);
}

function gs_app_verify_email($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'gs_subscribers';
    $token = $request->get_param('token');

    $subscriber = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE token = %s", $token));
    if (!$subscriber) {
        return new WP_REST_Response(
            '<html><body style="font-family:Arial;text-align:center;padding:60px;"><h1 style="color:#e53e3e;">Invalid Link</h1><p>This verification link is invalid or has expired.</p></body></html>',
            400,
            array('Content-Type' => 'text/html')
        );
    }

    $wpdb->update($table, array('confirmed' => 1), array('id' => $subscriber->id));

    $site_name = get_bloginfo('name');
    return new WP_REST_Response(
        '<html><body style="font-family:Arial;text-align:center;padding:60px;">
            <h1 style="color:#EA580C;">✓ Email Confirmed!</h1>
            <p style="color:#555;font-size:18px;">You will now receive notifications when new profiles are posted on <strong>' . esc_html($site_name) . '</strong>.</p>
            <a href="' . home_url() . '" style="display:inline-block;margin-top:20px;background:#EA580C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Visit Website</a>
        </body></html>',
        200,
        array('Content-Type' => 'text/html')
    );
}


// ============================================================
// AUTO-NOTIFY SUBSCRIBERS WHEN NEW POST IS PUBLISHED
// ============================================================
add_action('publish_post', 'gs_app_notify_subscribers', 10, 2);
function gs_app_notify_subscribers($post_id, $post) {
    // Only on first publish, not updates
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    if (wp_is_post_revision($post_id)) return;

    // Prevent duplicate sends
    $sent = get_post_meta($post_id, '_gs_subscribers_notified', true);
    if ($sent) return;
    update_post_meta($post_id, '_gs_subscribers_notified', '1');

    global $wpdb;
    $table = $wpdb->prefix . 'gs_subscribers';
    $subscribers = $wpdb->get_results("SELECT email, name, token FROM $table WHERE confirmed = 1");

    if (empty($subscribers)) return;

    $site_name  = get_bloginfo('name');
    $post_title = html_entity_decode(get_the_title($post_id), ENT_QUOTES, 'UTF-8');
    $post_url   = get_permalink($post_id);
    $post_excerpt = wp_trim_words(wp_strip_all_tags($post->post_content), 30, '...');

    // Get post image
    $image_url = '';
    $thumb_id = get_post_thumbnail_id($post_id);
    if ($thumb_id) {
        $img = wp_get_attachment_image_src($thumb_id, 'medium');
        if ($img) $image_url = $img[0];
    }

    $image_html = $image_url ? "<img src='$image_url' alt='' style='width:100%;max-width:400px;border-radius:8px;margin:16px 0;' />" : '';

    foreach ($subscribers as $sub) {
        $unsub_url = rest_url('gs-app/v1/verify-email') . '?token=' . urlencode($sub->token) . '&action=unsubscribe';
        $greeting  = $sub->name ? "Hi {$sub->name}," : "Hi,";

        $body = "<!DOCTYPE html><html><body style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;'>
            <div style='text-align:center;padding:20px 0;'>
                <h1 style='color:#EA580C;margin:0;font-size:24px;'>$site_name</h1>
            </div>
            <div style='background:#f9f9f9;border-radius:12px;padding:24px;'>
                <p style='font-size:16px;color:#333;'>$greeting</p>
                <p style='color:#555;line-height:1.6;'>A new profile has been posted!</p>
                <h2 style='color:#EA580C;font-size:20px;margin:16px 0 8px;'>$post_title</h2>
                $image_html
                <p style='color:#666;line-height:1.6;'>$post_excerpt</p>
                <div style='text-align:center;margin:24px 0;'>
                    <a href='$post_url' style='display:inline-block;background:#EA580C;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;'>View Profile →</a>
                </div>
            </div>
            <p style='text-align:center;margin-top:20px;'>
                <a href='$unsub_url' style='color:#999;font-size:11px;'>Unsubscribe from these notifications</a>
            </p>
        </body></html>";

        $headers = array(
            'Content-Type: text/html; charset=UTF-8',
            'From: ' . $site_name . ' <no-reply@' . parse_url(home_url(), PHP_URL_HOST) . '>',
            'List-Unsubscribe: <' . $unsub_url . '>',
        );

        wp_mail($sub->email, "New Profile: $post_title — $site_name", $body, $headers);
    }
}


// ============================================================
// HELPER — Build profile data from a WP_Post object
// ============================================================
function gs_app_build_profile($post) {
    $image_url = '';
    $thumb_id = get_post_thumbnail_id($post->ID);
    if ($thumb_id) {
        $img = wp_get_attachment_image_src($thumb_id, 'large');
        if ($img) $image_url = $img[0];
    }

    if (empty($image_url)) {
        $jetpack_url = get_post_meta($post->ID, '_jetpack_featured_media_url', true);
        if ($jetpack_url) $image_url = $jetpack_url;
    }

    if (empty($image_url)) {
        if (preg_match('/<img[^>]+src=["\']([^"\']+)["\']/', $post->post_content, $matches)) {
            $image_url = $matches[1];
        }
    }

    $comment_count = (int) get_comments_number($post->ID);

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
