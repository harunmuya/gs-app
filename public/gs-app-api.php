<?php
/**
 * Plugin Name: GS App API
 * Plugin URI: https://genuinesugarmummies.co.ke
 * Description: All-in-one REST API for the Genuine Sugarmummies App — profiles, comments, email subscriptions & notifications.
 * Version: 3.1.0
 * Author: GS Admin
 * License: GPL-2.0+
 *
 * ENDPOINTS:
 *   GET  /wp-json/gs-app/v1/profiles          → Paginated profiles
 *   GET  /wp-json/gs-app/v1/profiles/{id}      → Single profile + comments
 *   GET  /wp-json/gs-app/v1/comments/{post_id} → Approved comments
 *   POST /wp-json/gs-app/v1/comment             → Submit comment (moderated)
 *   POST /wp-json/gs-app/v1/subscribe           → Subscribe email
 *   GET  /wp-json/gs-app/v1/verify-email        → Confirm subscription
 *   GET  /wp-json/gs-app/v1/unsubscribe         → Unsubscribe
 */

if (!defined('ABSPATH')) exit;

// ============================================================
// AUTO-CREATE DB TABLE — runs on every page load if missing
// (This ensures the table exists even after plugin file updates)
// ============================================================
add_action('init', 'gs_app_ensure_table');
function gs_app_ensure_table() {
    global $wpdb;
    $table = $wpdb->prefix . 'gs_subscribers';

    // Only check once per request
    static $checked = false;
    if ($checked) return;
    $checked = true;

    // Quick existence check (cached)
    $version = get_option('gs_app_db_version', '0');
    if ($version === '3.1.0') return;

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
    update_option('gs_app_db_version', '3.1.0');
}

// Also run on activation
register_activation_hook(__FILE__, 'gs_app_ensure_table');


// ============================================================
// REGISTER ALL REST ROUTES
// ============================================================
add_action('rest_api_init', function () {

    // GET /profiles
    register_rest_route('gs-app/v1', '/profiles', array(
        'methods'             => 'GET',
        'callback'            => 'gs_app_get_profiles',
        'permission_callback' => '__return_true',
        'args'                => array(
            'page'     => array('default' => 1,  'sanitize_callback' => 'absint'),
            'per_page' => array('default' => 25, 'sanitize_callback' => 'absint'),
        ),
    ));

    // GET /profiles/{id}
    register_rest_route('gs-app/v1', '/profiles/(?P<id>\d+)', array(
        'methods'             => 'GET',
        'callback'            => 'gs_app_get_single_profile',
        'permission_callback' => '__return_true',
    ));

    // GET /comments/{post_id}
    register_rest_route('gs-app/v1', '/comments/(?P<post_id>\d+)', array(
        'methods'             => 'GET',
        'callback'            => 'gs_app_get_comments',
        'permission_callback' => '__return_true',
    ));

    // POST /comment
    register_rest_route('gs-app/v1', '/comment', array(
        'methods'             => 'POST',
        'callback'            => 'gs_app_submit_comment',
        'permission_callback' => '__return_true',
        'args'                => array(
            'post_id'      => array('required' => true, 'type' => 'integer', 'sanitize_callback' => 'absint'),
            'author_name'  => array('required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
            'author_email' => array('required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_email', 'validate_callback' => function($v) { return is_email($v); }),
            'content'      => array('required' => true, 'type' => 'string', 'sanitize_callback' => 'wp_kses_post'),
            'website'      => array('required' => false, 'type' => 'string', 'default' => ''),
        ),
    ));

    // POST /subscribe
    register_rest_route('gs-app/v1', '/subscribe', array(
        'methods'             => 'POST',
        'callback'            => 'gs_app_subscribe',
        'permission_callback' => '__return_true',
        'args'                => array(
            'email'       => array('required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_email', 'validate_callback' => function($v) { return is_email($v); }),
            'name'        => array('required' => false, 'type' => 'string', 'default' => '', 'sanitize_callback' => 'sanitize_text_field'),
            'is_verified' => array('required' => false, 'type' => 'boolean', 'default' => false),
        ),
    ));

    // GET /verify-email
    register_rest_route('gs-app/v1', '/verify-email', array(
        'methods'             => 'GET',
        'callback'            => 'gs_app_verify_email',
        'permission_callback' => '__return_true',
        'args'                => array(
            'token' => array('required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
        ),
    ));

    // GET /unsubscribe
    register_rest_route('gs-app/v1', '/unsubscribe', array(
        'methods'             => 'GET',
        'callback'            => 'gs_app_unsubscribe',
        'permission_callback' => '__return_true',
        'args'                => array(
            'token' => array('required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
        ),
    ));
});

add_filter('rest_allow_anonymous_comments', '__return_true');


// ============================================================
// RATE LIMITER
// ============================================================
function gs_app_rate_check($action = 'comment', $max = 5, $window = 600) {
    $ip = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    $key = 'gs_rate_' . $action . '_' . md5($ip);
    $count = (int) get_transient($key);
    if ($count >= $max) return false;
    set_transient($key, $count + 1, $window);
    return true;
}


// ============================================================
// PROFILES
// ============================================================
function gs_app_get_profiles($request) {
    $page     = max(1, (int) $request->get_param('page'));
    $per_page = min(100, max(1, (int) $request->get_param('per_page')));

    $query = new WP_Query(array(
        'post_type'      => 'post',
        'post_status'    => 'publish',
        'posts_per_page' => $per_page,
        'paged'          => $page,
        'orderby'        => 'date',
        'order'          => 'DESC',
    ));

    $profiles = array();
    foreach ($query->posts as $post) {
        $p = gs_app_build_profile($post);
        if ($p) $profiles[] = $p;
    }

    $response = rest_ensure_response(array(
        'profiles'   => $profiles,
        'page'       => $page,
        'per_page'   => $per_page,
        'totalPosts' => (int) $query->found_posts,
        'totalPages' => (int) $query->max_num_pages,
    ));
    $response->header('Cache-Control', 'public, max-age=300, s-maxage=300');
    $response->header('Access-Control-Allow-Origin', '*');
    return $response;
}


// ============================================================
// SINGLE PROFILE
// ============================================================
function gs_app_get_single_profile($request) {
    $post_id = (int) $request['id'];
    $post = get_post($post_id);

    if (!$post || $post->post_status !== 'publish')
        return new WP_Error('not_found', 'Profile not found.', array('status' => 404));

    $profile = gs_app_build_profile($post);
    if (!$profile)
        return new WP_Error('not_found', 'Profile not found.', array('status' => 404));

    $comments = get_comments(array(
        'post_id' => $post_id, 'status' => 'approve',
        'orderby' => 'comment_date', 'order' => 'DESC', 'number' => 50,
    ));
    $list = array();
    foreach ($comments as $c) {
        $list[] = array(
            'id' => (int) $c->comment_ID, 'author' => $c->comment_author,
            'content' => wp_strip_all_tags($c->comment_content), 'date' => $c->comment_date,
            'avatarUrl' => get_avatar_url($c->comment_author_email, array('size' => 48)),
        );
    }
    $profile['comments'] = $list;

    $response = rest_ensure_response(array('profiles' => array($profile)));
    $response->header('Cache-Control', 'public, max-age=120');
    $response->header('Access-Control-Allow-Origin', '*');
    return $response;
}


// ============================================================
// COMMENTS — GET
// ============================================================
function gs_app_get_comments($request) {
    $post_id = (int) $request['post_id'];
    $post = get_post($post_id);
    if (!$post || $post->post_status !== 'publish')
        return new WP_Error('not_found', 'Post not found.', array('status' => 404));

    $comments = get_comments(array(
        'post_id' => $post_id, 'status' => 'approve',
        'orderby' => 'comment_date', 'order' => 'DESC', 'number' => 100,
    ));
    $list = array();
    foreach ($comments as $c) {
        $list[] = array(
            'id' => (int) $c->comment_ID, 'author' => $c->comment_author,
            'content' => wp_strip_all_tags($c->comment_content), 'date' => $c->comment_date,
            'avatarUrl' => get_avatar_url($c->comment_author_email, array('size' => 48)),
        );
    }

    $response = rest_ensure_response(array('comments' => $list));
    $response->header('Cache-Control', 'public, max-age=60');
    $response->header('Access-Control-Allow-Origin', '*');
    return $response;
}


// ============================================================
// COMMENT — POST (rate limited + honeypot)
// ============================================================
function gs_app_submit_comment($request) {
    // Honeypot
    if (!empty($request->get_param('website'))) {
        return rest_ensure_response(array('success' => true, 'comment_id' => 0, 'status' => 'hold', 'message' => 'Comment submitted for moderation.'));
    }

    if (!gs_app_rate_check('comment', 5, 600))
        return new WP_Error('rate_limited', 'Too many comments. Please wait a few minutes.', array('status' => 429));

    $post_id      = $request->get_param('post_id');
    $author_name  = $request->get_param('author_name');
    $author_email = $request->get_param('author_email');
    $content      = $request->get_param('content');

    $post = get_post($post_id);
    if (!$post || $post->post_status !== 'publish')
        return new WP_Error('invalid_post', 'Post not found.', array('status' => 404));

    if (strlen($content) > 2000)
        return new WP_Error('content_too_long', 'Comment exceeds 2000 characters.', array('status' => 400));

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
        'comment_agent'        => 'GS-App/3.1',
    ));

    if (!$comment_id)
        return new WP_Error('comment_failed', 'Failed to create comment.', array('status' => 500));

    wp_notify_moderator($comment_id);

    return rest_ensure_response(array(
        'success' => true, 'comment_id' => $comment_id,
        'status' => 'hold', 'message' => 'Comment submitted for moderation.',
    ));
}


// ============================================================
// SUBSCRIBE — stores email and sends verification
// ============================================================
function gs_app_subscribe($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'gs_subscribers';

    // Ensure table exists
    gs_app_ensure_table();

    if (!gs_app_rate_check('subscribe', 3, 300))
        return new WP_Error('rate_limited', 'Too many requests. Please wait.', array('status' => 429));

    $email       = $request->get_param('email');
    $name        = $request->get_param('name') ?: '';
    $is_verified = (bool) $request->get_param('is_verified');

    // Check existing
    $existing = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE email = %s", $email));

    if ($existing) {
        if ($existing->confirmed) {
            return rest_ensure_response(array(
                'success' => true,
                'message' => 'You are already subscribed! You will receive notifications for new profiles.',
                'already_subscribed' => true,
            ));
        }
        // Resend verification
        gs_app_send_confirmation($email, $existing->name ?: $name, $existing->token);
        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Verification email resent! Please check your inbox and spam folder.',
        ));
    }

    // New subscriber
    $token = bin2hex(random_bytes(16)); // 32 char hex token

    $result = $wpdb->insert($table, array(
        'email'         => $email,
        'name'          => $name,
        'token'         => $token,
        'confirmed'     => 0,
        'verified_user' => $is_verified ? 1 : 0,
        'created_at'    => current_time('mysql'),
    ));

    if ($result === false) {
        return new WP_Error('db_error', 'Could not save subscription. Please try again.', array('status' => 500));
    }

    gs_app_send_confirmation($email, $name, $token);

    return rest_ensure_response(array(
        'success' => true,
        'message' => 'Please check your email (and spam folder) to confirm your subscription!',
    ));
}


// ============================================================
// SEND CONFIRMATION EMAIL — optimized for deliverability
// ============================================================
function gs_app_send_confirmation($email, $name, $token) {
    $site_name   = get_bloginfo('name');
    $site_url    = home_url();
    $admin_email = get_option('admin_email');

    // Build verify URL
    $verify_url = add_query_arg(
        array('token' => $token),
        rest_url('gs-app/v1/verify-email')
    );

    $greeting = $name ? "Hi $name," : "Hello,";

    // Plain text body (lowest spam score)
    $text_body  = "$greeting\n\n";
    $text_body .= "Thank you for subscribing to $site_name.\n\n";
    $text_body .= "Please confirm your email by visiting this link:\n";
    $text_body .= "$verify_url\n\n";
    $text_body .= "Once confirmed, you will receive email notifications whenever new profiles are posted.\n\n";
    $text_body .= "If you did not subscribe, simply ignore this email.\n\n";
    $text_body .= "Best regards,\n$site_name Team\n$site_url";

    // Headers — use admin email for From AND Return-Path
    $headers = array(
        'From: ' . $site_name . ' <' . $admin_email . '>',
        'Reply-To: ' . $admin_email,
        'Return-Path: ' . $admin_email,
        'X-Mailer: GS-App/3.1',
    );

    // Override the return-path at PHP level too
    add_filter('wp_mail_from', function() use ($admin_email) { return $admin_email; });
    add_filter('wp_mail_from_name', function() use ($site_name) { return $site_name; });

    wp_mail($email, "Confirm your subscription - $site_name", $text_body, $headers);
}


// ============================================================
// VERIFY EMAIL — confirms subscription (outputs HTML directly)
// ============================================================
function gs_app_verify_email($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'gs_subscribers';
    $token = $request->get_param('token');

    // Ensure table
    gs_app_ensure_table();

    if (empty($token) || strlen($token) < 10) {
        gs_app_html_page('Invalid Link', 'This verification link is invalid or malformed.', false);
    }

    $subscriber = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE token = %s", $token));

    if (!$subscriber) {
        $count = $wpdb->get_var("SELECT COUNT(*) FROM $table");
        $msg = 'This verification link could not be found. ';
        if ($count == 0) {
            $msg .= 'The subscriber database appears empty. Please try subscribing again from the app.';
        } else {
            $msg .= 'It may have expired or already been used. Please try subscribing again.';
        }
        gs_app_html_page('Link Not Found', $msg, false);
    }

    if ($subscriber->confirmed) {
        gs_app_html_page('Already Confirmed', 'Your email <strong>' . esc_html($subscriber->email) . '</strong> is already confirmed! You will be notified when new profiles are posted.', true);
    }

    // Confirm the subscriber
    $wpdb->update($table, array('confirmed' => 1), array('id' => $subscriber->id));

    $site_name = get_bloginfo('name');
    gs_app_html_page(
        'Email Confirmed!',
        'Your email <strong>' . esc_html($subscriber->email) . '</strong> has been confirmed.<br><br>You will now receive notifications whenever new profiles are posted on <strong>' . esc_html($site_name) . '</strong>.',
        true
    );
}


// ============================================================
// UNSUBSCRIBE
// ============================================================
function gs_app_unsubscribe($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'gs_subscribers';
    $token = $request->get_param('token');

    gs_app_ensure_table();

    $subscriber = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE token = %s", $token));

    if (!$subscriber) {
        gs_app_html_page('Not Found', 'This unsubscribe link is invalid or has already been used.', false);
    }

    $wpdb->delete($table, array('id' => $subscriber->id));

    gs_app_html_page(
        'Unsubscribed',
        'You have been unsubscribed from <strong>' . esc_html(get_bloginfo('name')) . '</strong> notifications. You will no longer receive emails about new profiles.',
        true
    );
}


// ============================================================
// HTML PAGE HELPER — outputs branded HTML directly and exits
// IMPORTANT: This function calls die() — it does NOT return!
// We must bypass WP REST API's JSON encoding to serve HTML.
// ============================================================
function gs_app_html_page($title, $message, $success) {
    $site_name = esc_html(get_bloginfo('name'));
    $site_url  = esc_url(home_url());
    $color     = $success ? '#16a34a' : '#dc2626';
    $bg_color  = $success ? '#f0fdf4' : '#fef2f2';
    $icon      = $success ? '&#10003;' : '&#10007;';
    $year      = date('Y');

    // Send proper HTTP headers
    status_header(200);
    header('Content-Type: text/html; charset=UTF-8');
    header('Cache-Control: no-store, no-cache');

    // Output HTML directly — bypasses WP REST JSON encoding
    echo '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>' . $title . ' - ' . $site_name . '</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f7f7f7;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:440px;width:100%;padding:40px 32px;text-align:center}
.icon{width:64px;height:64px;border-radius:50%;background:' . $bg_color . ';display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:28px;color:' . $color . '}
h1{font-size:22px;color:#1a1a1a;margin-bottom:12px}
p{font-size:15px;color:#555;line-height:1.6;margin-bottom:24px}
.btn{display:inline-block;background:#EA580C;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;transition:background .2s}
.btn:hover{background:#c2410c}
.footer{margin-top:28px;font-size:11px;color:#999}
strong{color:#333}
</style>
</head>
<body>
<div class="card">
<div class="icon">' . $icon . '</div>
<h1>' . $title . '</h1>
<p>' . $message . '</p>
<a href="' . $site_url . '" class="btn">Visit ' . $site_name . '</a>
<div class="footer">&copy; ' . $year . ' ' . $site_name . '</div>
</div>
</body>
</html>';

    // Stop execution — do NOT let WP REST API JSON-encode this
    die();
}


// ============================================================
// AUTO-NOTIFY SUBSCRIBERS ON NEW POST
// ============================================================
add_action('publish_post', 'gs_app_notify_subscribers', 10, 2);
function gs_app_notify_subscribers($post_id, $post) {
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    if (wp_is_post_revision($post_id)) return;

    // Prevent duplicate sends
    $sent = get_post_meta($post_id, '_gs_notified', true);
    if ($sent) return;
    update_post_meta($post_id, '_gs_notified', '1');

    global $wpdb;
    $table = $wpdb->prefix . 'gs_subscribers';

    // Check table exists
    if ($wpdb->get_var("SHOW TABLES LIKE '$table'") !== $table) return;

    $subscribers = $wpdb->get_results("SELECT email, name, token FROM $table WHERE confirmed = 1");
    if (empty($subscribers)) return;

    $site_name   = get_bloginfo('name');
    $site_url    = home_url();
    $admin_email = get_option('admin_email');
    $post_title  = html_entity_decode(get_the_title($post_id), ENT_QUOTES, 'UTF-8');
    $post_url    = get_permalink($post_id);
    $excerpt     = wp_trim_words(wp_strip_all_tags($post->post_content), 40, '...');

    foreach ($subscribers as $sub) {
        $unsub_url = add_query_arg(
            array('token' => $sub->token),
            rest_url('gs-app/v1/unsubscribe')
        );

        $greeting = $sub->name ? "Hi {$sub->name}," : "Hello,";

        // Plain text email for best deliverability
        $body = "$greeting\n\n";
        $body .= "A new profile has been posted on $site_name!\n\n";
        $body .= "TITLE: $post_title\n\n";
        $body .= "$excerpt\n\n";
        $body .= "View the full profile here:\n$post_url\n\n";
        $body .= "---\n";
        $body .= "To unsubscribe: $unsub_url\n\n";
        $body .= "$site_name\n$site_url";

        $headers = array(
            'From: ' . $site_name . ' <' . $admin_email . '>',
            'Reply-To: ' . $admin_email,
            'List-Unsubscribe: <' . $unsub_url . '>',
        );

        wp_mail($sub->email, "New Profile: $post_title", $body, $headers);
    }
}


// ============================================================
// HELPER — Build profile from WP_Post
// ============================================================
function gs_app_build_profile($post) {
    $image_url = '';
    $thumb_id = get_post_thumbnail_id($post->ID);
    if ($thumb_id) {
        $img = wp_get_attachment_image_src($thumb_id, 'large');
        if ($img) $image_url = $img[0];
    }
    if (empty($image_url)) {
        $jetpack = get_post_meta($post->ID, '_jetpack_featured_media_url', true);
        if ($jetpack) $image_url = $jetpack;
    }
    if (empty($image_url)) {
        if (preg_match('/<img[^>]+src=["\']([^"\']+)["\']/', $post->post_content, $m)) {
            $image_url = $m[1];
        }
    }

    $excerpt = wp_strip_all_tags($post->post_excerpt ?: $post->post_content);
    $excerpt = preg_replace('/continue\s+reading.*/i', '', $excerpt);
    $excerpt = preg_replace('/&hellip;/', '...', $excerpt);
    $excerpt = trim(mb_substr($excerpt, 0, 300));

    return array(
        'wpId'         => (int) $post->ID,
        'title'        => html_entity_decode(wp_strip_all_tags($post->post_title), ENT_QUOTES, 'UTF-8'),
        'excerpt'      => $excerpt,
        'content'      => apply_filters('the_content', $post->post_content),
        'imageUrl'     => $image_url,
        'date'         => $post->post_date,
        'link'         => get_permalink($post->ID),
        'commentCount' => (int) get_comments_number($post->ID),
    );
}
