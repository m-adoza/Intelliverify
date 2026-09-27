// ============================================================
// ADMIN ROUTES
// ============================================================
// Everything here requires role = 'admin'.
//
// GET    /api/admin/stats               dashboard metrics
// GET    /api/admin/users               list all users
// PATCH  /api/admin/users/:id/role      change a user's role
// DELETE /api/admin/users/:id           delete a user
// GET    /api/admin/pairings            list all supervisor-student pairs
// POST   /api/admin/pairings            force-link a pair
// DELETE /api/admin/pairings/:id        force-unlink
// ============================================================

const express = require('express');
const { admin } = require('../lib/supabase');
const { requireAuth, requireRole } = require('../lib/auth');
const { ApiError, asyncHandler } = require('../lib/errors');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

// ------------------------------------------------------------
// GET /api/admin/stats
// ------------------------------------------------------------

router.get(
    '/stats',
    asyncHandler(async (req, res) => {
        const [
            { count: totalUsers },
            { count: students },
            { count: supervisors },
            { count: admins },
            { count: totalTopics },
            { count: pendingTopics },
            { count: totalReports },
            { count: highRiskReports }
        ] = await Promise.all([
            admin.from('profiles').select('*', { count: 'exact', head: true }),
            admin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
            admin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'supervisor'),
            admin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
            admin.from('topics').select('*', { count: 'exact', head: true }),
            admin.from('topics').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
            admin.from('plagiarism_reports').select('*', { count: 'exact', head: true }),
            admin.from('plagiarism_reports').select('*', { count: 'exact', head: true }).eq('risk_level', 'high')
        ]);

        res.json({
            users: { total: totalUsers, students, supervisors, admins },
            topics: { total: totalTopics, pending: pendingTopics },
            reports: { total: totalReports, high_risk: highRiskReports }
        });
    })
);

// ------------------------------------------------------------
// GET /api/admin/users
// ------------------------------------------------------------

router.get(
    '/users',
    asyncHandler(async (req, res) => {
        const { data, error } = await admin
            .from('profiles')
            .select('id, email, full_name, role, department, pairing_code, created_at')
            .order('created_at', { ascending: false });

        if (error) throw new ApiError(500, error.message);

        res.json({ users: data || [] });
    })
);

// ------------------------------------------------------------
// PATCH /api/admin/users/:id/role
// Body: { role: 'student'|'supervisor'|'admin' }
// ------------------------------------------------------------

router.patch(
    '/users/:id/role',
    asyncHandler(async (req, res) => {
        const { role } = req.body || {};

        if (!['student', 'supervisor', 'admin'].includes(role)) {
            throw new ApiError(400, 'Invalid role.');
        }

        if (req.params.id === req.user.id) {
            throw new ApiError(400, 'You cannot change your own role.');
        }

        // Prevent removing the last admin
        if (role !== 'admin') {
            const { data: current } = await admin
                .from('profiles')
                .select('role')
                .eq('id', req.params.id)
                .single();

            if (current?.role === 'admin') {
                const { count } = await admin
                    .from('profiles')
                    .select('*', { count: 'exact', head: true })
                    .eq('role', 'admin');

                if ((count || 0) <= 1) {
                    throw new ApiError(409, 'Cannot demote the last admin.');
                }
            }
        }

        const { error } = await admin
            .from('profiles')
            .update({ role })
            .eq('id', req.params.id);

        if (error) throw new ApiError(500, error.message);

        // Notify the target
        await admin.from('notifications').insert({
            user_id: req.params.id,
            type: 'role_changed',
            title: 'Your role was updated',
            body: `An administrator changed your role to ${role}.`
        });

        res.json({ message: `Role updated to ${role}.` });
    })
);

// ------------------------------------------------------------
// DELETE /api/admin/users/:id
// ------------------------------------------------------------

router.delete(
    '/users/:id',
    asyncHandler(async (req, res) => {
        if (req.params.id === req.user.id) {
            throw new ApiError(400, 'You cannot delete your own account.');
        }

        const { data: target } = await admin
            .from('profiles')
            .select('role')
            .eq('id', req.params.id)
            .single();

        if (!target) throw new ApiError(404, 'User not found.');

        if (target.role === 'admin') {
            const { count } = await admin
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('role', 'admin');

            if ((count || 0) <= 1) {
                throw new ApiError(409, 'Cannot delete the last admin.');
            }
        }

        // Deleting the auth user cascades to profiles and everything else
        const { error } = await admin.auth.admin.deleteUser(req.params.id);
        if (error) throw new ApiError(500, error.message);

        res.json({ message: 'User deleted.' });
    })
);

// ------------------------------------------------------------
// GET /api/admin/pairings
// ------------------------------------------------------------

router.get(
    '/pairings',
    asyncHandler(async (req, res) => {
        const { data, error } = await admin
            .from('assignments')
            .select(`
                id, linked_by, linked_at,
                supervisor:profiles!assignments_supervisor_id_fkey (
                    id, full_name, email
                ),
                student:profiles!assignments_student_id_fkey (
                    id, full_name, email
                )
            `)
            .order('linked_at', { ascending: false });

        if (error) throw new ApiError(500, error.message);

        res.json({ pairings: data || [] });
    })
);

// ------------------------------------------------------------
// POST /api/admin/pairings
// Body: { supervisor_id, student_id }
// ------------------------------------------------------------

router.post(
    '/pairings',
    asyncHandler(async (req, res) => {
        const { supervisor_id, student_id } = req.body || {};

        if (!supervisor_id || !student_id) {
            throw new ApiError(400, 'supervisor_id and student_id are required.');
        }

        // Validate roles
        const { data: people } = await admin
            .from('profiles')
            .select('id, role')
            .in('id', [supervisor_id, student_id]);

        const sup = (people || []).find(p => p.id === supervisor_id);
        const stu = (people || []).find(p => p.id === student_id);

        if (!sup || sup.role !== 'supervisor') {
            throw new ApiError(400, 'Chosen supervisor is not a supervisor.');
        }
        if (!stu || stu.role !== 'student') {
            throw new ApiError(400, 'Chosen student is not a student.');
        }

        // Insert
        const { data, error } = await admin
            .from('assignments')
            .insert({
                supervisor_id,
                student_id,
                linked_by: 'admin'
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                throw new ApiError(409, 'That pair already exists.');
            }
            throw new ApiError(500, error.message);
        }

        // Notify both
        await admin.from('notifications').insert([
            {
                user_id: student_id,
                type: 'pairing_linked',
                title: 'Supervisor assigned',
                body: 'An administrator linked you to a supervisor.',
                link: '/student/pairing.html'
            },
            {
                user_id: supervisor_id,
                type: 'pairing_linked',
                title: 'Student assigned',
                body: 'An administrator assigned a student to you.',
                link: '/supervisor/assigned-students.html'
            }
        ]);

        res.status(201).json({ message: 'Pair created.', pairing: data });
    })
);

// ------------------------------------------------------------
// DELETE /api/admin/pairings/:id
// ------------------------------------------------------------

router.delete(
    '/pairings/:id',
    asyncHandler(async (req, res) => {
        const { error } = await admin
            .from('assignments')
            .delete()
            .eq('id', req.params.id);

        if (error) throw new ApiError(500, error.message);

        res.json({ message: 'Pair removed.' });
    })
);

module.exports = router;
