const BADGE_MESSAGE_TYPES = new Set([
    'admin',
    'admin_email',
    'member_message',
    'message',
    'package',
    'package_request',
    'security',
    'welcome',
]);

export function unreadMessageValue(item = {}) {
    if (!item || item.badgeCount === false || item.countsAsUnread === false || item.systemOnly) return 0;
    const unreadCount = Math.max(0, Number(item.unreadCount || 0));
    if (unreadCount > 0) return unreadCount;
    if (item.read) return 0;
    if (item.badgeCount === true || item.countsAsUnread === true) return 1;
    const id = String(item.id || '');
    if (id.startsWith('chat-') || id.startsWith('admin-')) return 1;
    if (id.startsWith('msg-')) return 0;
    return BADGE_MESSAGE_TYPES.has(String(item.type || '')) ? 1 : 0;
}

export function unreadActivityValue(item = {}) {
    if (!item || item.read || item.badgeCount === false || item.countsAsUnread === false || item.systemOnly) return 0;
    return item.badgeCount === true || item.countsAsUnread === true ? 1 : 0;
}
