// ============================================================
// MESSAGE ROUTES
// ============================================================
// GET  /api/messages/conversations       list chat partners
// GET  /api/messages/thread/:otherId     messages with a user
// POST /api/messages                     send a message
// ============================================================

const express = require('express');
const { admin } = require('../lib/supabase');
const { requireAuth } = require('../lib/auth');
const { ApiError, asyncHandler } = require('../lib/errors');

const router = express.Router();

// ------------------------------------------------------------
// GET /api/messages/conversations
// Returns one row per chat partner (student ↔ their supervisors,
// supervisor ↔ their students).
// ------------------------------------------------------------

router.get(
    '/conversations',
    requireAuth,
    asyncHandler(async (req, res) => {
        const me = req.user.id;
        const role = req.user.profile.role;

        // Which partners am I allowed to talk to?
        let partnerIds = [];

        if (role === 'student') {
            const { data: links } = await admin
                .from('assignments')
                .select('supervisor_id')
                .eq('student_id', me);
            partnerIds = (links || []).map(l => l.supervisor_id);
        } else if (role === 'supervisor') {
            const { data: links } = await admin
                .from('assignments')
                .select('student_id')
                .eq('supervisor_id', me);
            partnerIds = (links || []).map(l => l.student_id);
        } else {
            // admin: everyone
            const { data: all } = await admin
                .from('profiles')
                .select('id')
                .neq('id', me);
            partnerIds = (all || []).map(p => p.id);
        }

        if (!partnerIds.length) {
            return res.json({ conversations: [] });
        }

        // Fetch partner profiles
        const { data: partners, error } = await admin
            .from('profiles')
            .select('id, full_name, email, role')
            .in('id', partnerIds);

        if (error) throw new ApiError(500, error.message);

        // For each partner, get the latest message + unread count
        const enriched = await Promise.all(
            (partners || []).map(async (p) => {
                const { data: last } = await admin
                    .from('messages')
                    .select('content, created_at, sender_id')
                    .or(
                        `and(sender_id.eq.${me},receiver_id.eq.${p.id}),` +
                        `and(sender_id.eq.${p.id},receiver_id.eq.${me})`
                    )
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                const { count: unread } = await admin
                    .from('messages')
                    .select('*', { count: 'exact', head: true })
                    .eq('sender_id', p.id)
                    .eq('receiver_id', me)
                    .eq('is_read', false);

                return {
                    partner: p,
                    last_message: last || null,
                    unread_count: unread || 0
                };
            })
        );

        // Sort by latest activity
        enriched.sort((a, b) => {
            const aT = a.last_message?.created_at || '';
            const bT = b.last_message?.created_at || '';
            return bT.localeCompare(aT);
        });

        res.json({ conversations: enriched });
    })
);

// ------------------------------------------------------------
// GET /api/messages/thread/:otherId
// ------------------------------------------------------------

router.get(
    '/thread/:otherId',
    requireAuth,
    asyncHandler(async (req, res) => {
        const me = req.user.id;
        const other = req.params.otherId;

        if (other === me) {
            throw new ApiError(400, 'Cannot open a thread with yourself.');
        }

        // Authorization: must be linked, or admin
        const allowed = await canMessage(req.user, other);
        if (!allowed) {
            throw new ApiError(403, 'You are not connected to this user.');
        }

        const { data: messages, error } = await admin
            .from('messages')
            .select(`
                message_id, sender_id, receiver_id, content, is_read, created_at,
                sender:profiles!messages_sender_id_fkey (
                    id, full_name, role
                )
            `)
            .or(
                `and(sender_id.eq.${me},receiver_id.eq.${other}),` +
                `and(sender_id.eq.${other},receiver_id.eq.${me})`
            )
            .order('created_at', { ascending: true })
            .limit(500);

        if (error) throw new ApiError(500, error.message);

        // Mark incoming as read
        await admin
            .from('messages')
            .update({ is_read: true })
            .eq('sender_id', other)
            .eq('receiver_id', me)
            .eq('is_read', false);

        // Partner info
        const { data: partner } = await admin
            .from('profiles')
            .select('id, full_name, email, role')
            .eq('id', other)
            .single();

        res.json({ partner, messages: messages || [] });
    })
);

// ------------------------------------------------------------
// POST /api/messages
// Body: { receiver_id, content, topic_id? }
// ------------------------------------------------------------

router.post(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
        const { receiver_id, content, topic_id } = req.body || {};

        if (!receiver_id || !content) {
            throw new ApiError(400, 'receiver_id and content are required.');
        }
        if (content.trim().length === 0) {
            throw new ApiError(400, 'Message cannot be empty.');
        }
        if (content.length > 4000) {
            throw new ApiError(400, 'Message is too long (max 4000 chars).');
        }

        const allowed = await canMessage(req.user, receiver_id);
        if (!allowed) {
            throw new ApiError(403, 'You are not connected to this user.');
        }

        const { data: msg, error } = await admin
            .from('messages')
            .insert({
                sender_id: req.user.id,
                receiver_id,
                content: content.trim(),
                topic_id: topic_id || null
            })
            .select('*')
            .single();

        if (error) throw new ApiError(500, error.message);

        // Notify receiver
        await admin.from('notifications').insert({
            user_id: receiver_id,
            type: 'new_message',
            title: 'New message',
            body: `${req.user.profile.full_name || req.user.email}: ${content.slice(0, 80)}${content.length > 80 ? '…' : ''}`,
            link: req.user.profile.role === 'supervisor'
                ? '/supervisor/messages.html'
                : '/student/messages.html'
        });

        res.status(201).json({ message: msg });
    })
);

// ------------------------------------------------------------
// HELPER
// ------------------------------------------------------------

async function canMessage(user, otherId) {
    if (user.profile.role === 'admin') return true;
    if (user.id === otherId) return false;

    const { data: link } = await admin
        .from('assignments')
        .select('id')
        .or(
            `and(supervisor_id.eq.${user.id},student_id.eq.${otherId}),` +
            `and(supervisor_id.eq.${otherId},student_id.eq.${user.id})`
        )
        .maybeSingle();

    return Boolean(link);
}

module.exports = router;
