// ============================================================
// NOTIFICATION ROUTES
// ============================================================
// GET  /api/notifications                 list own
// GET  /api/notifications/unread-count    small counter
// POST /api/notifications/:id/read        mark one as read
// POST /api/notifications/read-all        mark all as read
// ============================================================

const express = require('express');
const { admin } = require('../lib/supabase');
const { requireAuth } = require('../lib/auth');
const { ApiError, asyncHandler } = require('../lib/errors');

const router = express.Router();

// ------------------------------------------------------------
// GET /api/notifications
// ------------------------------------------------------------

router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
        const { data, error } = await admin
            .from('notifications')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw new ApiError(500, error.message);

        res.json({ notifications: data || [] });
    })
);

// ------------------------------------------------------------
// GET /api/notifications/unread-count
// ------------------------------------------------------------

router.get(
    '/unread-count',
    requireAuth,
    asyncHandler(async (req, res) => {
        const { count, error } = await admin
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', req.user.id)
            .eq('is_read', false);

        if (error) throw new ApiError(500, error.message);

        res.json({ unread: count || 0 });
    })
);

// ------------------------------------------------------------
// POST /api/notifications/:id/read
// ------------------------------------------------------------

router.post(
    '/:id/read',
    requireAuth,
    asyncHandler(async (req, res) => {
        const { error } = await admin
            .from('notifications')
            .update({ is_read: true })
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);   // RLS-style guard

        if (error) throw new ApiError(500, error.message);

        res.json({ message: 'Marked as read.' });
    })
);

// ------------------------------------------------------------
// POST /api/notifications/read-all
// ------------------------------------------------------------

router.post(
    '/read-all',
    requireAuth,
    asyncHandler(async (req, res) => {
        const { error } = await admin
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', req.user.id)
            .eq('is_read', false);

        if (error) throw new ApiError(500, error.message);

        res.json({ message: 'All notifications marked as read.' });
    })
);

module.exports = router;
