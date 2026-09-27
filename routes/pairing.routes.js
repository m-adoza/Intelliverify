// ============================================================
// PAIRING ROUTES
// ============================================================
// Students own a pairing code. Supervisors redeem it.
// Admin can force-link/unlink via admin.routes.js.
// ============================================================

const express = require('express');
const { admin } = require('../lib/supabase');
const { requireAuth, requireRole } = require('../lib/auth');
const { ApiError, asyncHandler } = require('../lib/errors');

const router = express.Router();

// ------------------------------------------------------------
// GET /api/pairing/me  (student)
// Returns own pairing code + list of linked supervisors.
// ------------------------------------------------------------

router.get(
    '/me',
    requireAuth,
    requireRole('student'),
    asyncHandler(async (req, res) => {
        const { profile } = req.user;

        const { data: links, error } = await admin
            .from('assignments')
            .select(`
                id,
                linked_by,
                linked_at,
                supervisor:profiles!assignments_supervisor_id_fkey (
                    id, full_name, email, department
                )
            `)
            .eq('student_id', profile.id)
            .order('linked_at', { ascending: false });

        if (error) throw new ApiError(500, error.message);

        res.json({
            pairing_code: profile.pairing_code,
            supervisors: (links || []).map(l => ({
                assignment_id: l.id,
                linked_by: l.linked_by,
                linked_at: l.linked_at,
                supervisor: l.supervisor
            }))
        });
    })
);

// ------------------------------------------------------------
// GET /api/pairing/students  (supervisor)
// Returns the list of students linked to the current supervisor.
// ------------------------------------------------------------

router.get(
    '/students',
    requireAuth,
    requireRole('supervisor'),
    asyncHandler(async (req, res) => {
        const { profile } = req.user;

        const { data: links, error } = await admin
            .from('assignments')
            .select(`
                id,
                linked_by,
                linked_at,
                student:profiles!assignments_student_id_fkey (
                    id, full_name, email, department, pairing_code
                )
            `)
            .eq('supervisor_id', profile.id)
            .order('linked_at', { ascending: false });

        if (error) throw new ApiError(500, error.message);

        res.json({
            students: (links || []).map(l => ({
                assignment_id: l.id,
                linked_by: l.linked_by,
                linked_at: l.linked_at,
                student: l.student
            }))
        });
    })
);

// ------------------------------------------------------------
// POST /api/pairing/redeem  (supervisor)
// Body: { code: "IV-XXXXXX" }
// ------------------------------------------------------------

router.post(
    '/redeem',
    requireAuth,
    requireRole('supervisor'),
    asyncHandler(async (req, res) => {
        const { code } = req.body || {};

        if (!code || typeof code !== 'string') {
            throw new ApiError(400, 'A pairing code is required.');
        }

        // Normalize: uppercase, trim, ensure IV- prefix
        let normalized = code.trim().toUpperCase();
        if (!normalized.startsWith('IV-')) {
            normalized = 'IV-' + normalized.replace(/^IV-?/, '');
        }

        // Find the student
        const { data: student, error: studentError } = await admin
            .from('profiles')
            .select('id, full_name, email, role, pairing_code')
            .eq('pairing_code', normalized)
            .maybeSingle();

        if (studentError) throw new ApiError(500, studentError.message);

        if (!student) {
            throw new ApiError(404, 'No student found with that pairing code.');
        }

        if (student.role !== 'student') {
            throw new ApiError(400, 'That code does not belong to a student.');
        }

        if (student.id === req.user.id) {
            throw new ApiError(400, 'You cannot link to your own account.');
        }

        // Check for existing link
        const { data: existing } = await admin
            .from('assignments')
            .select('id')
            .eq('supervisor_id', req.user.id)
            .eq('student_id', student.id)
            .maybeSingle();

        if (existing) {
            throw new ApiError(409, 'You are already supervising this student.');
        }

        // Create the assignment
        const { data: assignment, error: insertError } = await admin
            .from('assignments')
            .insert({
                supervisor_id: req.user.id,
                student_id: student.id,
                linked_by: 'code'
            })
            .select()
            .single();

        if (insertError) throw new ApiError(500, insertError.message);

        // Notify the student
        await admin.from('notifications').insert({
            user_id: student.id,
            type: 'pairing_linked',
            title: 'New supervisor linked',
            body: `${req.user.profile.full_name || req.user.email} is now supervising your project.`,
            link: '/student/pairing.html'
        });

        res.status(201).json({
            message: 'Student linked successfully.',
            assignment: {
                id: assignment.id,
                linked_at: assignment.linked_at,
                student: {
                    id: student.id,
                    full_name: student.full_name,
                    email: student.email
                }
            }
        });
    })
);

// ------------------------------------------------------------
// DELETE /api/pairing/:assignmentId
// Either party can unlink.
// ------------------------------------------------------------

router.delete(
    '/:assignmentId',
    requireAuth,
    asyncHandler(async (req, res) => {
        const { assignmentId } = req.params;

        const { data: link, error } = await admin
            .from('assignments')
            .select('id, supervisor_id, student_id')
            .eq('id', assignmentId)
            .maybeSingle();

        if (error) throw new ApiError(500, error.message);
        if (!link) throw new ApiError(404, 'Link not found.');

        const isSupervisor = link.supervisor_id === req.user.id;
        const isStudent    = link.student_id    === req.user.id;

        if (!isSupervisor && !isStudent) {
            throw new ApiError(403, 'You cannot unlink this pair.');
        }

        const { error: deleteError } = await admin
            .from('assignments')
            .delete()
            .eq('id', assignmentId);

        if (deleteError) throw new ApiError(500, deleteError.message);

        // Notify the other party
        const otherId = isSupervisor ? link.student_id : link.supervisor_id;
        await admin.from('notifications').insert({
            user_id: otherId,
            type: 'pairing_unlinked',
            title: 'Supervision link removed',
            body: `${req.user.profile.full_name || req.user.email} unlinked from your account.`,
            link: isSupervisor ? '/student/pairing.html' : '/supervisor/assigned-students.html'
        });

        res.json({ message: 'Link removed.' });
    })
);

module.exports = router;
