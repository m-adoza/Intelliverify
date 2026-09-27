// ============================================================
// TOPIC ROUTES
// ============================================================
// POST   /api/topics              student submits
// GET    /api/topics              list (role-aware)
// GET    /api/topics/:id          single topic + history
// POST   /api/topics/:id/review   supervisor action
// DELETE /api/topics/:id          student deletes (pending/revision only)
// ============================================================

const express = require('express');
const { admin } = require('../lib/supabase');
const { requireAuth, requireRole } = require('../lib/auth');
const { ApiError, asyncHandler } = require('../lib/errors');

const router = express.Router();

const REVIEW_ACTIONS = ['approved', 'revision', 'rejected'];

// ------------------------------------------------------------
// POST /api/topics   (student)
// ------------------------------------------------------------

router.post(
    '/',
    requireAuth,
    requireRole('student'),
    asyncHandler(async (req, res) => {
        const {
            title, research_area, problem_statement, objectives,
            keywords, plagiarism_report_id
        } = req.body || {};

        // Required fields
        for (const [field, value] of Object.entries({
            title, research_area, problem_statement, objectives
        })) {
            if (!value || String(value).trim().length < 3) {
                throw new ApiError(400, `Field "${field}" is required.`);
            }
        }

        // If a report is attached, validate it
        if (plagiarism_report_id) {
            const { data: report } = await admin
                .from('plagiarism_reports')
                .select('report_id, user_id, similarity_score, scan_status')
                .eq('report_id', plagiarism_report_id)
                .maybeSingle();

            if (!report) throw new ApiError(404, 'Attached report not found.');
            if (report.user_id !== req.user.id) {
                throw new ApiError(403, 'You can only attach your own reports.');
            }
            if (report.scan_status !== 'completed') {
                throw new ApiError(400, 'Attached report is not yet completed.');
            }
            if (report.similarity_score > 30) {
                throw new ApiError(
                    400,
                    'This report cannot be attached — similarity is above 30%.'
                );
            }
        }

        // Insert topic
        const { data: topic, error } = await admin
            .from('topics')
            .insert({
                student_id: req.user.id,
                title: title.trim(),
                research_area: research_area.trim(),
                problem_statement: problem_statement.trim(),
                objectives: objectives.trim(),
                keywords: keywords ? keywords.trim() : null,
                plagiarism_report_id: plagiarism_report_id || null,
                status: 'pending'
            })
            .select('*')
            .single();

        if (error) throw new ApiError(500, error.message);

        // Write the initial history entry
        await admin.from('topic_status_history').insert({
            topic_id: topic.topic_id,
            actor_id: req.user.id,
            old_status: null,
            new_status: 'pending',
            comment: 'Topic submitted.'
        });

        // Notify all linked supervisors
        const { data: links } = await admin
            .from('assignments')
            .select('supervisor_id')
            .eq('student_id', req.user.id);

        if (links && links.length) {
            await admin.from('notifications').insert(
                links.map(l => ({
                    user_id: l.supervisor_id,
                    type: 'topic_submitted',
                    title: 'New topic proposal',
                    body: `${req.user.profile.full_name || req.user.email} submitted "${topic.title}".`,
                    link: '/supervisor/dashboard.html'
                }))
            );
        }

        res.status(201).json({
            message: 'Topic submitted for review.',
            topic
        });
    })
);

// ------------------------------------------------------------
// GET /api/topics   (role-aware)
// ------------------------------------------------------------

router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
        const role = req.user.profile.role;

        let query = admin
            .from('topics')
            .select(`
                topic_id, title, research_area, status, submitted_at,
                reviewer_id, reviewer_comment, reviewed_at,
                plagiarism_report_id,
                student:profiles!topics_student_id_fkey (
                    id, full_name, email
                )
            `)
            .order('submitted_at', { ascending: false })
            .limit(200);

        if (role === 'student') {
            query = query.eq('student_id', req.user.id);
        } else if (role === 'supervisor') {
            const { data: links } = await admin
                .from('assignments')
                .select('student_id')
                .eq('supervisor_id', req.user.id);

            const ids = (links || []).map(l => l.student_id);
            if (!ids.length) return res.json({ topics: [] });
            query = query.in('student_id', ids);
        }
        // admin: no filter

        const { data, error } = await query;
        if (error) throw new ApiError(500, error.message);

        res.json({ topics: data || [] });
    })
);

// ------------------------------------------------------------
// GET /api/topics/:id
// ------------------------------------------------------------

router.get(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
        const { data: topic, error } = await admin
            .from('topics')
            .select(`
                *,
                student:profiles!topics_student_id_fkey (
                    id, full_name, email, department
                ),
                reviewer:profiles!topics_reviewer_id_fkey (
                    id, full_name, email
                ),
                report:plagiarism_reports (
                    report_id, filename, file_format, similarity_score,
                    risk_level, matches, recommendation, storage_path,
                    created_at
                )
            `)
            .eq('topic_id', req.params.id)
            .maybeSingle();

        if (error) throw new ApiError(500, error.message);
        if (!topic) throw new ApiError(404, 'Topic not found.');

        const allowed = await canAccessTopic(req.user, topic.student_id);
        if (!allowed) throw new ApiError(403, 'Access denied.');

        // History
        const { data: history } = await admin
            .from('topic_status_history')
            .select(`
                id, old_status, new_status, comment, created_at,
                actor:profiles!topic_status_history_actor_id_fkey (
                    id, full_name, email, role
                )
            `)
            .eq('topic_id', topic.topic_id)
            .order('created_at', { ascending: true });

        res.json({ topic, history: history || [] });
    })
);

// ------------------------------------------------------------
// POST /api/topics/:id/review   (supervisor)
// Body: { action: 'approved'|'revision'|'rejected', comment }
// ------------------------------------------------------------

router.post(
    '/:id/review',
    requireAuth,
    requireRole('supervisor'),
    asyncHandler(async (req, res) => {
        const { action, comment } = req.body || {};

        if (!REVIEW_ACTIONS.includes(action)) {
            throw new ApiError(
                400,
                `action must be one of: ${REVIEW_ACTIONS.join(', ')}`
            );
        }

        const { data: topic } = await admin
            .from('topics')
            .select('topic_id, student_id, status, title')
            .eq('topic_id', req.params.id)
            .maybeSingle();

        if (!topic) throw new ApiError(404, 'Topic not found.');

        // Must be linked to this student
        const { data: link } = await admin
            .from('assignments')
            .select('id')
            .eq('supervisor_id', req.user.id)
            .eq('student_id', topic.student_id)
            .maybeSingle();

        if (!link) {
            throw new ApiError(403, 'You do not supervise this student.');
        }

        // First-review-wins rule
        if (['approved', 'rejected'].includes(topic.status)) {
            throw new ApiError(
                409,
                `This topic has already been ${topic.status} and cannot be changed.`
            );
        }

        const previousStatus = topic.status;

        // Update
        const { error: updateError } = await admin
            .from('topics')
            .update({
                status: action,
                reviewer_id: req.user.id,
                reviewer_comment: comment || null,
                reviewed_at: new Date().toISOString()
            })
            .eq('topic_id', topic.topic_id);

        if (updateError) throw new ApiError(500, updateError.message);

        // History
        await admin.from('topic_status_history').insert({
            topic_id: topic.topic_id,
            actor_id: req.user.id,
            old_status: previousStatus,
            new_status: action,
            comment: comment || null
        });

        // Notify the student
        await admin.from('notifications').insert({
            user_id: topic.student_id,
            type: 'topic_reviewed',
            title: `Topic ${action}`,
            body: `Your topic "${topic.title}" was marked as ${action}.` +
                  (comment ? ` Comment: ${comment}` : ''),
            link: '/student/approval-status.html'
        });

        // Notify other linked supervisors (excluding the actor)
        const { data: otherLinks } = await admin
            .from('assignments')
            .select('supervisor_id')
            .eq('student_id', topic.student_id)
            .neq('supervisor_id', req.user.id);

        if (otherLinks && otherLinks.length) {
            await admin.from('notifications').insert(
                otherLinks.map(l => ({
                    user_id: l.supervisor_id,
                    type: 'topic_reviewed_by_peer',
                    title: `Topic ${action} by another supervisor`,
                    body: `"${topic.title}" was marked as ${action} by ${req.user.profile.full_name || req.user.email}.`,
                    link: '/supervisor/dashboard.html'
                }))
            );
        }

        res.json({ message: `Topic ${action}.` });
    })
);

// ------------------------------------------------------------
// DELETE /api/topics/:id   (student, while pending/revision)
// ------------------------------------------------------------

router.delete(
    '/:id',
    requireAuth,
    requireRole('student'),
    asyncHandler(async (req, res) => {
        const { data: topic } = await admin
            .from('topics')
            .select('topic_id, student_id, status')
            .eq('topic_id', req.params.id)
            .maybeSingle();

        if (!topic) throw new ApiError(404, 'Topic not found.');
        if (topic.student_id !== req.user.id) {
            throw new ApiError(403, 'You can only delete your own topics.');
        }
        if (!['pending', 'revision'].includes(topic.status)) {
            throw new ApiError(
                409,
                `Cannot delete a topic that has been ${topic.status}.`
            );
        }

        const { error } = await admin
            .from('topics')
            .delete()
            .eq('topic_id', topic.topic_id);

        if (error) throw new ApiError(500, error.message);

        res.json({ message: 'Topic deleted.' });
    })
);

// ------------------------------------------------------------
// HELPER
// ------------------------------------------------------------

async function canAccessTopic(user, studentId) {
    if (user.profile.role === 'admin') return true;
    if (user.profile.role === 'student') return studentId === user.id;

    if (user.profile.role === 'supervisor') {
        const { data: link } = await admin
            .from('assignments')
            .select('id')
            .eq('supervisor_id', user.id)
            .eq('student_id', studentId)
            .maybeSingle();
        return Boolean(link);
    }

    return false;
}

module.exports = router;
